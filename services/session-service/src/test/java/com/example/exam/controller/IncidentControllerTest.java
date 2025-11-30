package com.example.exam.controller;

import com.example.exam.dto.IncidentDto;
import com.example.exam.model.Incident;
import com.example.exam.model.IncidentStatus;
import com.example.exam.model.IncidentType;
import com.example.exam.repository.IncidentRepository;
import com.example.exam.repository.SessionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = IncidentController.class)
@AutoConfigureMockMvc(addFilters = false)
@SuppressWarnings("null")
class IncidentControllerTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper om;

    @MockBean
    IncidentRepository incidentRepository;

    @MockBean
    SessionRepository sessionRepository;

    @Test
    void createIncident_happyPath_returnsCreated() throws Exception {
        UUID sessionId = UUID.randomUUID();
        when(sessionRepository.existsById(eq(sessionId))).thenReturn(true);

        Mockito.lenient().when(incidentRepository.save(any())).thenAnswer(invocation -> {
            Incident i = invocation.getArgument(0);
            if (i.getId() == null) setField(i, "id", UUID.randomUUID());
            if (i.getCreatedAt() == null) setField(i, "createdAt", Instant.now());
            return i;
        });

        IncidentDto.CreateRequest req = new IncidentDto.CreateRequest();
        req.sessionId = sessionId;
        req.ts = 12345L;
        req.type = IncidentType.NO_FACE;
        req.score = new BigDecimal("0.85");
        req.reason = "No face detected";
        req.evidenceUrl = "s3://bucket/key.jpg";

        mvc.perform(post("/api/incidents")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.sessionId", is(sessionId.toString())))
                .andExpect(jsonPath("$.ts", is(12345)))
                .andExpect(jsonPath("$.type", is("NO_FACE")))
                .andExpect(jsonPath("$.score", is(0.85)))
                .andExpect(jsonPath("$.reason", is("No face detected")))
                .andExpect(jsonPath("$.evidenceUrl", is("s3://bucket/key.jpg")))
                .andExpect(jsonPath("$.status", is("OPEN")))
                .andExpect(jsonPath("$.createdAt", notNullValue()));
    }

    @Test
    void createIncident_missingSession_returns404() throws Exception {
        UUID sessionId = UUID.randomUUID();
        when(sessionRepository.existsById(eq(sessionId))).thenReturn(false);

        IncidentDto.CreateRequest req = new IncidentDto.CreateRequest();
        req.sessionId = sessionId;
        req.ts = 1L;
        req.type = IncidentType.PASTE;

        mvc.perform(post("/api/incidents")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(req)))
                .andExpect(status().isNotFound());
    }

    @Test
    void listIncidents_bySession_returnsOrdered() throws Exception {
        UUID sessionId = UUID.randomUUID();
        when(incidentRepository.findBySessionIdOrderByTsAsc(eq(sessionId))).thenReturn(List.of(
                buildIncident(sessionId, 2L, IncidentType.PASTE),
                buildIncident(sessionId, 3L, IncidentType.TAB_ABUSE)
        ));

        mvc.perform(get("/api/incidents").param("sessionId", sessionId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].sessionId", is(sessionId.toString())));
    }

    @Test
    void getIncident_found_returns200() throws Exception {
        UUID id = UUID.randomUUID();
    Incident i = buildIncident(UUID.randomUUID(), 5L, IncidentType.NO_FACE);
    setField(i, "id", id);
        when(incidentRepository.findById(eq(id))).thenReturn(Optional.of(i));

        mvc.perform(get("/api/incidents/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(id.toString())));
    }

    @Test
    void getIncident_notFound_returns404() throws Exception {
        UUID id = UUID.randomUUID();
        when(incidentRepository.findById(eq(id))).thenReturn(Optional.empty());

        mvc.perform(get("/api/incidents/" + id))
                .andExpect(status().isNotFound());
    }

    private Incident buildIncident(UUID sessionId, long ts, IncidentType type) {
        Incident i = new Incident();
        setField(i, "id", UUID.randomUUID());
        i.setSessionId(sessionId);
        i.setTs(ts);
        i.setType(type);
        i.setStatus(IncidentStatus.OPEN);
        setField(i, "createdAt", Instant.now());
        return i;
    }

    private static void setField(Object target, String fieldName, Object value) {
        try {
            var f = target.getClass().getDeclaredField(fieldName);
            f.setAccessible(true);
            f.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}

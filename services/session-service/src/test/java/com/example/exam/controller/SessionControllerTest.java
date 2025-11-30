package com.example.exam.controller;

import com.example.exam.dto.StartSessionRequest;
import com.example.exam.model.Session;
import com.example.exam.model.SessionStatus;
import com.example.exam.repository.SessionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = SessionController.class)
@AutoConfigureMockMvc(addFilters = false)
@SuppressWarnings("null")
class SessionControllerTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockBean
    SessionRepository sessionRepository;

    @Test
    void startSession_happyPath() throws Exception {
        UUID examId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        String userId = "22222222-2222-2222-2222-222222222222";

        Session saved = new Session();
        saved.setExamId(examId);
        saved.setUserId(userId);
        saved.setStartedAt(Instant.parse("2025-11-04T00:00:00Z"));
        saved.setStatus(SessionStatus.ACTIVE);

        when(sessionRepository.save(any(Session.class))).thenReturn(saved);
        
        // Mock SecurityUtils static method using mockito-inline or similar if possible, 
        // but since we can't easily mock static methods without extra config, 
        // and we changed the controller to use SecurityUtils.getCurrentUserId(),
        // we might need to refactor Controller to use a helper service or just rely on the fact that 
        // SecurityUtils gets from SecurityContext.
        // For this test, we can mock the SecurityContext.
        
        // However, setting up full SecurityContext mock is verbose. 
        // Let's assume for now we can mock the static method if mockito-inline is present, 
        // OR we can just set the SecurityContextHolder.
        
        org.springframework.security.core.context.SecurityContextHolder.setContext(
            new org.springframework.security.core.context.SecurityContextImpl(
                new org.springframework.security.authentication.TestingAuthenticationToken(
                    new org.springframework.security.oauth2.jwt.Jwt(
                        "token", 
                        Instant.now(), 
                        Instant.now().plusSeconds(300), 
                        java.util.Map.of("alg", "none"), 
                        java.util.Map.of("sub", userId)
                    ), 
                    null
                )
            )
        );

        StartSessionRequest req = new StartSessionRequest();
        req.setExamId(examId);
        // req.setUserId(userId); // Removed from DTO

        mvc.perform(post("/api/sessions/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.examId").value(examId.toString()))
                .andExpect(jsonPath("$.userId").value(userId))
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    void startSession_invalidUuid_returns400() throws Exception {
        String body = "{\n  \"examId\": \"not-a-uuid\"\n}";

        mvc.perform(post("/api/sessions/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON_VALUE));
    }

    @Test
    void startSession_missingFields_returns400_withProblemDetail() throws Exception {
        // Empty body should trigger validation error (both fields @NotNull)
        String body = "{}";

    mvc.perform(post("/api/sessions/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON_VALUE))
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors.examId").exists());
    }

    @Test
    void listSessions_returnsArray() throws Exception {
        Session s = new Session();
        s.setExamId(UUID.fromString("11111111-1111-1111-1111-111111111111"));
        s.setUserId("22222222-2222-2222-2222-222222222222");
        s.setStartedAt(Instant.parse("2025-11-04T00:00:00Z"));
        s.setStatus(SessionStatus.ACTIVE);
        when(sessionRepository.findAll()).thenReturn(List.of(s));

        mvc.perform(get("/api/sessions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("ACTIVE"));
    }

    @Test
    void endSession_happyPath() throws Exception {
        Session s = new Session();
        s.setExamId(UUID.fromString("11111111-1111-1111-1111-111111111111"));
        s.setUserId("22222222-2222-2222-2222-222222222222");
        s.setStartedAt(Instant.parse("2025-11-04T00:00:00Z"));
        s.setStatus(SessionStatus.ACTIVE);

        when(sessionRepository.findById(any(UUID.class))).thenReturn(Optional.of(s));
        when(sessionRepository.save(any(Session.class))).thenReturn(s);

        mvc.perform(post("/api/sessions/" + UUID.randomUUID() + "/end"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ENDED"));
    }
}

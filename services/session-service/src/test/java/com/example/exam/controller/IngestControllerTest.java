package com.example.exam.controller;

import com.example.exam.dto.EventIngestDto;
import com.example.exam.dto.SnapshotIngestDto;
import com.example.exam.service.IngestService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = IngestController.class)
@AutoConfigureMockMvc(addFilters = false)
@SuppressWarnings("null")
class IngestControllerTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockBean
    IngestService ingestService;

    @Test
    void ingestEvents_happyPath() throws Exception {
        var id1 = UUID.randomUUID();
        when(ingestService.ingestEvents(any(EventIngestDto.Request.class)))
                .thenReturn(new EventIngestDto.Result(1, 0, List.of(id1)));

        String body = "{\n" +
                "  \"items\": [\n" +
                "    {\n" +
                "      \"sessionId\": \"00000000-0000-0000-0000-000000000001\",\n" +
                "      \"ts\": 1,\n" +
                "      \"eventType\": \"TAB_SWITCH\",\n" +
                "      \"idempotencyKey\": \"evt-1\"\n" +
                "    }\n" +
                "  ]\n" +
                "}";

        mvc.perform(post("/api/ingest/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(1))
                .andExpect(jsonPath("$.duplicates").value(0))
                .andExpect(jsonPath("$.ids[0]").value(id1.toString()));
    }

    @Test
    void ingestEvents_validationError_returns400() throws Exception {
        // Missing required fields in item -> 400
        String body = "{ \"items\": [ { } ] }";

        mvc.perform(post("/api/ingest/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void ingestSnapshots_happyPath() throws Exception {
        var id1 = UUID.randomUUID();
        when(ingestService.ingestSnapshots(any(SnapshotIngestDto.Request.class)))
                .thenReturn(new SnapshotIngestDto.Result(1, 0, List.of(id1)));

        String body = "{\n" +
                "  \"items\": [\n" +
                "    {\n" +
                "      \"sessionId\": \"00000000-0000-0000-0000-000000000001\",\n" +
                "      \"ts\": 1,\n" +
                "      \"objectKey\": \"s3://bucket/key.jpg\",\n" +
                "      \"idempotencyKey\": \"snap-1\"\n" +
                "    }\n" +
                "  ]\n" +
                "}";

        mvc.perform(post("/api/ingest/snapshots")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(1))
                .andExpect(jsonPath("$.duplicates").value(0))
                .andExpect(jsonPath("$.ids[0]").value(id1.toString()));
    }

    @Test
    void ingestSnapshots_validationError_returns400() throws Exception {
        String body = "{ \"items\": [ { } ] }";

        mvc.perform(post("/api/ingest/snapshots")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }
}

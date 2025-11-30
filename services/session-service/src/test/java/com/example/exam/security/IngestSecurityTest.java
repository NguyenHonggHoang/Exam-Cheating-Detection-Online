package com.example.exam.security;

import com.example.exam.dto.EventIngestDto;
import com.example.exam.service.IngestService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "security.require-auth=true",
    "spring.security.oauth2.resourceserver.jwt.public-key-location=classpath:keys/dev-public.pem"
})
@AutoConfigureMockMvc
@SuppressWarnings("null")
class IngestSecurityTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean
    IngestService ingestService; // mock to avoid DB access during security tests

    @Test
    void ingestEvents_withoutToken_should401() throws Exception {
        mockMvc.perform(post("/api/ingest/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"sessionId\":\"00000000-0000-0000-0000-000000000001\",\"ts\":1,\"eventType\":\"TAB_SWITCH\",\"idempotencyKey\":\"k1\"}] }"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void ingestEvents_withUserRole_should200() throws Exception {
        when(ingestService.ingestEvents(any(EventIngestDto.Request.class)))
                .thenReturn(new EventIngestDto.Result(1,0, List.of(UUID.randomUUID())));

        mockMvc.perform(post("/api/ingest/events")
            .with(jwt()
                .jwt(j -> j.claim("roles", java.util.List.of("USER")))
                .authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_USER"))
            )
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"sessionId\":\"00000000-0000-0000-0000-000000000001\",\"ts\":1,\"eventType\":\"TAB_SWITCH\",\"idempotencyKey\":\"k1\"}] }"))
                .andExpect(status().isOk());
    }
}

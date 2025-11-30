package com.example.exam.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "security.require-auth=true",
    "spring.security.oauth2.resourceserver.jwt.public-key-location=classpath:keys/dev-public.pem"
})
@AutoConfigureMockMvc
@SuppressWarnings("null")
class ReviewSecurityTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void reviews_withoutToken_should401() throws Exception {
        mockMvc.perform(get("/api/admin/reviews").param("incidentId", UUID.randomUUID().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void reviews_withUserRole_should403() throws Exception {
        mockMvc.perform(get("/api/admin/reviews").param("incidentId", UUID.randomUUID().toString())
                        .with(jwt()
                                .jwt(j -> j.claim("roles", java.util.List.of("USER")))
                                .authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_USER"))
                        ))
                .andExpect(status().isForbidden());
    }

    @Test
    void reviews_withAdminRole_shouldReachController() throws Exception {
        // Authorized but no data -> expect 404
        mockMvc.perform(get("/api/admin/reviews").param("incidentId", UUID.randomUUID().toString())
                        .with(jwt()
                                .jwt(j -> j.claim("roles", java.util.List.of("ADMIN")))
                                .authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ADMIN"))
                        ))
                .andExpect(status().isNotFound());
    }
}

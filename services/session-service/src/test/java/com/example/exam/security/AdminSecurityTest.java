package com.example.exam.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;

@SpringBootTest(properties = {
    "security.require-auth=true",
    "spring.security.oauth2.resourceserver.jwt.public-key-location=classpath:keys/dev-public.pem"
})
@AutoConfigureMockMvc
@SuppressWarnings("null")
class AdminSecurityTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void adminPing_withoutToken_should401() throws Exception {
        mockMvc.perform(get("/api/admin/ping").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminPing_withUserRole_should403() throws Exception {
    mockMvc.perform(get("/api/admin/ping")
            .with(jwt()
                .jwt(j -> j.claim("roles", java.util.List.of("USER")))
                .authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_USER"))
            ))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminPing_withAdminRole_should200() throws Exception {
    mockMvc.perform(get("/api/admin/ping")
            .with(jwt()
                .jwt(j -> j.claim("roles", java.util.List.of("ADMIN")))
                .authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ADMIN"))
            ))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"status\":\"ok\"}"));
    }
}

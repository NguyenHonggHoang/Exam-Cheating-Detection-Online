package com.example.exam.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/**", "/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                // Allow proctor-token for monitoring (TODO: add proper auth in production)
                .requestMatchers("/api/sessions/proctor-token").permitAll()
                // Allow exam-related endpoints for testing
                .requestMatchers("/api/sessions/exam/**").permitAll()
                .requestMatchers("/api/sessions/by-exam/**").permitAll()
                // Allow session join for LiveKit token (student joins exam) - use regex pattern
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/sessions/*/join").permitAll()
                // Allow mock-exam endpoints
                .requestMatchers("/api/mock-exam/**").permitAll()
                // Allow session start for mock exam
                .requestMatchers("/api/sessions/start").permitAll()
                // Allow WebSocket connection
                .requestMatchers("/ws/**").permitAll()
                // Allow exam management (for proctor list)
                .requestMatchers("/api/exams/**").permitAll()
                .anyRequest().authenticated())
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())))
            .cors(Customizer.withDefaults())
            .csrf(AbstractHttpConfigurer::disable);
        return http.build();
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter grantedAuthoritiesConverter = new JwtGrantedAuthoritiesConverter();
        // The authorities are already prefixed with ROLE_ in the token (e.g. "authorities": ["ROLE_CANDIDATE"])
        // So we don't need to add another prefix, or we can map from "authorities" claim.
        // By default, it looks for "scope" or "scp". We want "authorities".
        grantedAuthoritiesConverter.setAuthoritiesClaimName("authorities");
        grantedAuthoritiesConverter.setAuthorityPrefix(""); // No additional prefix needed if already present

        JwtAuthenticationConverter jwtConverter = new JwtAuthenticationConverter();
        jwtConverter.setJwtGrantedAuthoritiesConverter(grantedAuthoritiesConverter);
        return jwtConverter;
    }
}

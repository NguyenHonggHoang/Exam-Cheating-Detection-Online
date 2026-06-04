package com.examplatform.admin.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

@Configuration
public class JwtDecoderConfig {

    @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}")
    private String jwkSetUri;

    @Bean
    public JwtDecoder jwtDecoder() {
        // Nimbus RemoteJWKSet automatically caches the JWK set for 15 minutes by default,
        // which successfully mitigates JWKS token validation spikes on the Authorization Server.
        return NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
    }
}

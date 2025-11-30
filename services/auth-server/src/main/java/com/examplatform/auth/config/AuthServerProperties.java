package com.examplatform.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.auth")
public record AuthServerProperties(
        String issuer,
        ConfidentialClientProperties bffClient,
        PublicClientProperties spaClient,
        CorsProperties cors
) {

    public record ConfidentialClientProperties(String clientId, String clientSecret, String redirectUri) {
    }

    public record PublicClientProperties(String clientId, String redirectUri) {
    }

    public record CorsProperties(String[] allowedOrigins) {
    }
}



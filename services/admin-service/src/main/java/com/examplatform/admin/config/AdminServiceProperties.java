package com.examplatform.admin.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "admin")
public record AdminServiceProperties(
        ApiUser apiUser,
        SeedClient seedClient
) {

    public AdminServiceProperties {
        if (apiUser == null) {
            apiUser = new ApiUser("admin", "change-me");
        }
        if (seedClient == null) {
            seedClient = new SeedClient(
                    "exam-bff-client",
                    "exam-bff-secret",
                    List.of("http://localhost:8080/api/auth/callback/exam-oidc"),
                    List.of("http://localhost:8080"),
                    List.of("openid", "profile")
            );
        }
    }

    public record ApiUser(String username, String password) {
    }

    public record SeedClient(
            String clientId,
            String clientSecret,
            List<String> redirectUris,
            List<String> postLogoutRedirectUris,
            List<String> scopes
    ) {
    }
}


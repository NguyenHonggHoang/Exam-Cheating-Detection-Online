package com.examplatform.auth.config;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;

import java.time.Duration;
import java.util.UUID;

@Configuration
public class RegisteredClientSeeder {

    @Bean
    ApplicationRunner registerClients(
            RegisteredClientRepository repository,
            PasswordEncoder passwordEncoder,
            AuthServerProperties properties
    ) {
        return args -> {
            if (properties.bffClient() != null) {
                seedConfidentialClient(repository, passwordEncoder, properties.bffClient());
            }
            if (properties.spaClient() != null) {
                seedSpaClient(repository, properties.spaClient());
            }
            // Seed clients for microservices with specific scopes
            seedServiceClient(repository, passwordEncoder, "admin-service", "admin-secret", 
                    java.util.Set.of("exam.read", "exam.write", "admin.manage", "incident.read"));
            seedServiceClient(repository, passwordEncoder, "session-service", "session-secret", 
                    java.util.Set.of("incident.write", "exam.read"));
            seedServiceClient(repository, passwordEncoder, "incident-service", "incident-secret", 
                    java.util.Set.of("incident.read", "incident.write"));
            seedServiceClient(repository, passwordEncoder, "user-service", "user-secret", 
                    java.util.Set.of("exam.read"));
            seedServiceClient(repository, passwordEncoder, "auth-service", "auth-secret", 
                    java.util.Set.of("exam.read")); // auth-service được gọi user-service
        };
    }

    private void seedConfidentialClient(RegisteredClientRepository repository,
                                        PasswordEncoder passwordEncoder,
                                        AuthServerProperties.ConfidentialClientProperties client) {
        if (repository.findByClientId(client.clientId()) != null) {
            return;
        }

        String baseUrl;
        try {
            java.net.URI uri = java.net.URI.create(client.redirectUri());
            baseUrl = uri.getScheme() + "://" + uri.getAuthority();
        } catch (Exception e) {
            baseUrl = "http://localhost:5174";
        }
        
        String postLogoutRedirectUri = "http://localhost:5174";

        RegisteredClient registeredClient = RegisteredClient.withId(UUID.randomUUID().toString())
                .clientId(client.clientId())
                .clientName("Exam BFF Client")
                .clientSecret(passwordEncoder.encode(client.clientSecret()))
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                // PASSWORD grant (ROPC) is required for programmatic login in load tests.
                // This grant allows the test script to obtain tokens without browser interaction.
                // WARNING: Do NOT enable this in production for user-facing clients.
                .authorizationGrantType(AuthorizationGrantType.PASSWORD)
                .redirectUri(client.redirectUri())
                .postLogoutRedirectUri(postLogoutRedirectUri)
                .scope(OidcScopes.OPENID)
                .scope(OidcScopes.PROFILE)
                .scope("exam.read")
                .scope("exam.write")
                .scope("incident.read")
                .scope("incident.write")
                .scope("admin.manage")
                .clientSettings(ClientSettings.builder()
                        .requireAuthorizationConsent(false) // ROPC does not support consent screen
                        .build())
                .tokenSettings(TokenSettings.builder()
                        .accessTokenTimeToLive(Duration.ofMinutes(15))
                        .refreshTokenTimeToLive(Duration.ofHours(12))
                        .reuseRefreshTokens(false)
                        .build())
                .build();

        repository.save(registeredClient);
    }

    private void seedSpaClient(RegisteredClientRepository repository,
                               AuthServerProperties.PublicClientProperties client) {
        if (repository.findByClientId(client.clientId()) != null) {
            return;
        }

        String postLogoutRedirectUri = client.redirectUri().contains("/auth/callback") 
                ? client.redirectUri().substring(0, client.redirectUri().indexOf("/auth/callback"))
                : "http://localhost:5174";
        
        RegisteredClient registeredClient = RegisteredClient.withId(UUID.randomUUID().toString())
                .clientId(client.clientId())
                .clientName("React Test Client")
                .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .redirectUri(client.redirectUri())
                .postLogoutRedirectUri(postLogoutRedirectUri)
                .scope(OidcScopes.OPENID)
                .scope(OidcScopes.PROFILE)
                .scope("exam.read")
                .scope("exam.write")
                .scope("incident.read")
                .scope("incident.write")
                .clientSettings(ClientSettings.builder()
                        .requireAuthorizationConsent(false)
                        .requireProofKey(true)
                        .build())
                .tokenSettings(TokenSettings.builder()
                        .accessTokenTimeToLive(Duration.ofMinutes(10))
                        .refreshTokenTimeToLive(Duration.ofHours(6))
                        .reuseRefreshTokens(false)
                        .build())
                .build();

        repository.save(registeredClient);
    }

    private void seedServiceClient(RegisteredClientRepository repository,
                                   PasswordEncoder passwordEncoder,
                                   String clientId,
                                   String clientSecret,
                                   java.util.Set<String> scopes) {
        if (repository.findByClientId(clientId) != null) {
            return;
        }

        RegisteredClient.Builder builder = RegisteredClient.withId(UUID.randomUUID().toString())
                .clientId(clientId)
                .clientName(clientId + " Client")
                .clientSecret(passwordEncoder.encode(clientSecret))
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
                .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS);

        for (String scope : scopes) {
            builder.scope(scope);
        }

        RegisteredClient registeredClient = builder
                .tokenSettings(TokenSettings.builder()
                        .accessTokenTimeToLive(Duration.ofHours(1))
                        .build())
                .build();

        repository.save(registeredClient);
    }
}


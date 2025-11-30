package com.examplatform.admin.startup;

import com.examplatform.admin.config.AdminServiceProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.UUID;

@Component
public class RegisteredClientSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(RegisteredClientSeeder.class);

    private final RegisteredClientRepository registeredClientRepository;
    private final PasswordEncoder passwordEncoder;
    private final AdminServiceProperties properties;

    public RegisteredClientSeeder(RegisteredClientRepository registeredClientRepository,
                                  PasswordEncoder passwordEncoder,
                                  AdminServiceProperties properties) {
        this.registeredClientRepository = registeredClientRepository;
        this.passwordEncoder = passwordEncoder;
        this.properties = properties;
    }

    @Override
    public void run(String... args) {
        var seedClient = properties.seedClient();
        var existing = registeredClientRepository.findByClientId(seedClient.clientId());
        if (existing != null) {
            log.info("Seed client '{}' already present", seedClient.clientId());
            return;
        }
        var scopes = new LinkedHashSet<>(seedClient.scopes());
        var registeredClient = RegisteredClient.withId(UUID.randomUUID().toString())
                .clientId(seedClient.clientId())
                .clientSecret(passwordEncoder.encode(seedClient.clientSecret()))
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .redirectUris(uris -> uris.addAll(seedClient.redirectUris()))
                .postLogoutRedirectUris(uris -> uris.addAll(seedClient.postLogoutRedirectUris()))
                .scopes(scopes::addAll)
                .clientSettings(ClientSettings.builder()
                        .requireAuthorizationConsent(true)
                        .requireProofKey(true)
                        .build())
                .tokenSettings(TokenSettings.builder()
                        .accessTokenTimeToLive(Duration.ofMinutes(10))
                        .refreshTokenTimeToLive(Duration.ofDays(1))
                        .reuseRefreshTokens(false)
                        .build())
                .build();
        registeredClientRepository.save(registeredClient);
        log.info("Seeded OAuth client '{}'", seedClient.clientId());
    }
}


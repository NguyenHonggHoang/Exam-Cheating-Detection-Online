package com.examplatform.admin.service;

import com.examplatform.admin.exception.ClientNotFoundException;
import com.examplatform.admin.web.dto.OAuthClientCreateRequest;
import com.examplatform.admin.web.dto.OAuthClientResponse;
import com.examplatform.admin.web.dto.OAuthClientUpdateRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;

import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class OAuthClientService {

    private final RegisteredClientRepository registeredClientRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    public OAuthClientService(RegisteredClientRepository registeredClientRepository,
                              PasswordEncoder passwordEncoder,
                              JdbcTemplate jdbcTemplate) {
        this.registeredClientRepository = registeredClientRepository;
        this.passwordEncoder = passwordEncoder;
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<OAuthClientResponse> findAll() {
        var ids = jdbcTemplate.queryForList(
                "select id from oauth2_registered_client order by client_id", String.class);
        return ids.stream()
                .map(registeredClientRepository::findById)
                .filter(Objects::nonNull)
                .map(this::toResponse)
                .toList();
    }

    public OAuthClientResponse findByClientId(String clientId) {
        var registeredClient = registeredClientRepository.findByClientId(clientId);
        if (registeredClient == null) {
            throw new ClientNotFoundException(clientId);
        }
        return toResponse(registeredClient);
    }

    public OAuthClientResponse create(OAuthClientCreateRequest request) {
        if (registeredClientRepository.findByClientId(request.clientId()) != null) {
            throw new IllegalArgumentException("Client already exists: " + request.clientId());
        }
        var registeredClient = RegisteredClient.withId(UUID.randomUUID().toString())
                .clientId(request.clientId())
                .clientSecret(passwordEncoder.encode(request.clientSecret()))
                .clientName(request.clientName())
                .clientAuthenticationMethods(methods -> methods.addAll(toAuthMethods(request.authenticationMethods())))
                .authorizationGrantTypes(grants -> grants.addAll(toGrantTypes(request.grantTypes())))
                .redirectUris(uris -> uris.addAll(request.redirectUris()))
                .postLogoutRedirectUris(uris -> {
                    if (request.postLogoutRedirectUris() != null) {
                        uris.addAll(request.postLogoutRedirectUris());
                    }
                })
                .scopes(scopes -> scopes.addAll(applyDefaultScopes(request.scopes())))
                .tokenSettings(defaultTokenSettings())
                .clientSettings(ClientSettings.builder()
                        .requireAuthorizationConsent(true)
                        .build())
                .build();
        registeredClientRepository.save(registeredClient);
        return toResponse(registeredClient);
    }

    public OAuthClientResponse update(String clientId, OAuthClientUpdateRequest request) {
        var existing = registeredClientRepository.findByClientId(clientId);
        if (existing == null) {
            throw new ClientNotFoundException(clientId);
        }
        var builder = RegisteredClient.from(existing)
                .clientName(request.clientName())
                .redirectUris(uris -> {
                    uris.clear();
                    uris.addAll(request.redirectUris());
                })
                .postLogoutRedirectUris(uris -> {
                    uris.clear();
                    if (request.postLogoutRedirectUris() != null) {
                        uris.addAll(request.postLogoutRedirectUris());
                    }
                })
                .scopes(scopes -> {
                    scopes.clear();
                    scopes.addAll(applyDefaultScopes(request.scopes()));
                });

        if (request.grantTypes() != null && !request.grantTypes().isEmpty()) {
            builder.authorizationGrantTypes(grants -> {
                grants.clear();
                grants.addAll(toGrantTypes(request.grantTypes()));
            });
        }
        if (request.authenticationMethods() != null && !request.authenticationMethods().isEmpty()) {
            builder.clientAuthenticationMethods(methods -> {
                methods.clear();
                methods.addAll(toAuthMethods(request.authenticationMethods()));
            });
        }
        if (StringUtils.hasText(request.clientSecret())) {
            builder.clientSecret(passwordEncoder.encode(request.clientSecret()));
        }
        var updated = builder.build();
        registeredClientRepository.save(updated);
        return toResponse(updated);
    }

    public void delete(String clientId) {
        var rows = jdbcTemplate.update("delete from oauth2_registered_client where client_id = ?", clientId);
        if (rows == 0) {
            throw new ClientNotFoundException(clientId);
        }
    }

    private OAuthClientResponse toResponse(RegisteredClient client) {
        return new OAuthClientResponse(
                client.getId(),
                client.getClientId(),
                client.getClientName(),
                client.getClientAuthenticationMethods().stream()
                        .map(ClientAuthenticationMethod::getValue)
                        .collect(Collectors.toCollection(java.util.LinkedHashSet::new)),
                client.getAuthorizationGrantTypes().stream()
                        .map(AuthorizationGrantType::getValue)
                        .collect(Collectors.toCollection(java.util.LinkedHashSet::new)),
                client.getRedirectUris(),
                client.getPostLogoutRedirectUris(),
                client.getScopes()
        );
    }

    private Set<ClientAuthenticationMethod> toAuthMethods(Set<String> methods) {
        return methods.stream()
                .map(ClientAuthenticationMethod::new)
                .collect(Collectors.toSet());
    }

    private Set<AuthorizationGrantType> toGrantTypes(Set<String> grants) {
        return grants.stream()
                .map(AuthorizationGrantType::new)
                .collect(Collectors.toSet());
    }

    private Set<String> applyDefaultScopes(Set<String> scopes) {
        var result = scopes.stream().collect(Collectors.toCollection(java.util.LinkedHashSet::new));
        result.add(OidcScopes.OPENID);
        result.add(OidcScopes.PROFILE);
        return result;
    }

    private TokenSettings defaultTokenSettings() {
        return TokenSettings.builder()
                .accessTokenTimeToLive(Duration.ofMinutes(10))
                .refreshTokenTimeToLive(Duration.ofHours(24))
                .reuseRefreshTokens(false)
                .build();
    }
}


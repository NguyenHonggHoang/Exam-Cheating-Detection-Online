package com.example.exam.config;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import org.springframework.security.oauth2.client.OAuth2AuthorizeRequest;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.stereotype.Component;

/**
 * Feign Request Interceptor for Service-to-Service Authentication
 * Automatically injects OAuth2 access token (from Client Credentials flow) into Feign requests
 */
@Component
public class OAuth2FeignRequestInterceptor implements RequestInterceptor {

    private static final String REGISTRATION_ID = "internal-client";
    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final OAuth2AuthorizedClientManager authorizedClientManager;

    public OAuth2FeignRequestInterceptor(OAuth2AuthorizedClientManager authorizedClientManager) {
        this.authorizedClientManager = authorizedClientManager;
    }

    @Override
    public void apply(RequestTemplate requestTemplate) {
        // Build authorization request for service-to-service communication
        OAuth2AuthorizeRequest authorizeRequest = OAuth2AuthorizeRequest
                .withClientRegistrationId(REGISTRATION_ID)
                .principal("session-service") // Service identity
                .build();

        // Authorize client and get access token
        var authorizedClient = authorizedClientManager.authorize(authorizeRequest);

        if (authorizedClient != null) {
            OAuth2AccessToken accessToken = authorizedClient.getAccessToken();
            
            if (accessToken != null) {
                // Inject Bearer token into request header
                requestTemplate.header(AUTHORIZATION_HEADER, BEARER_PREFIX + accessToken.getTokenValue());
            }
        }
    }
}

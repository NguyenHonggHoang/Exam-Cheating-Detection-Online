package com.examplatform.admin.web.dto;

import java.util.Set;

public record OAuthClientResponse(
        String id,
        String clientId,
        String clientName,
        Set<String> authenticationMethods,
        Set<String> grantTypes,
        Set<String> redirectUris,
        Set<String> postLogoutRedirectUris,
        Set<String> scopes
) {
}


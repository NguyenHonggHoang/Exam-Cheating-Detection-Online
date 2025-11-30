package com.examplatform.admin.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.Set;

public record OAuthClientCreateRequest(
        @NotBlank String clientId,
        @NotBlank String clientName,
        @NotBlank String clientSecret,
        @NotEmpty Set<@NotBlank String> redirectUris,
        @NotEmpty Set<@NotBlank String> scopes,
        @NotNull Set<@NotBlank String> grantTypes,
        @NotNull Set<@NotBlank String> authenticationMethods,
        Set<@NotBlank String> postLogoutRedirectUris
) {
}


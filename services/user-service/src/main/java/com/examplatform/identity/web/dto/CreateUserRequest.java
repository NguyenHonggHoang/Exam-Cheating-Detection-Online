package com.examplatform.identity.web.dto;

import com.examplatform.identity.domain.RoleName;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateUserRequest(
        @NotBlank @Size(min = 4, max = 50) String username,
        @NotBlank @Size(min = 8, max = 72) String password,
        @NotBlank @Email String email,
        @NotNull RoleName role
) {
}


package com.examplatform.admin.web.dto;

import java.util.Set;

public record UserResponse(
        String id,
        String username,
        String email,
        boolean enabled,
        Set<String> authorities
) {
}
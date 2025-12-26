package com.examplatform.identity.web.dto;

import com.examplatform.identity.domain.RoleName;

public record UpdateUserRequest(
    Boolean enabled,
    RoleName role
) {}

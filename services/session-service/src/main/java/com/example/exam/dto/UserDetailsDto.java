package com.example.exam.dto;

import java.util.Set;

/**
 * DTO representing user details fetched from user-service
 */
public record UserDetailsDto(
    String id,
    String username,
    String email,
    boolean enabled,
    Set<String> authorities
) {}

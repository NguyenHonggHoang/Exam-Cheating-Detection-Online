package com.example.exam.util;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.stream.Collectors;

/**
 * Utility class to extract user information from JWT in SecurityContext
 */
@Component
public class SecurityUtils {

    /**
     * Get the current authenticated user's ID from JWT 'sub' claim
     * @return User ID (UUID string)
     * @throws IllegalStateException if no authenticated user
     */
    public static String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        
        if (auth instanceof JwtAuthenticationToken jwtAuth) {
            Jwt jwt = jwtAuth.getToken();
            return jwt.getSubject(); // Extract 'sub' claim
        }
        
        throw new IllegalStateException("No authenticated JWT user found");
    }

    /**
     * Get the current authenticated user's authorities from JWT
     * @return Set of authority strings (e.g., "ROLE_CANDIDATE")
     */
    public static Set<String> getCurrentAuthorities() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
    }

    /**
     * Check if current user has a specific authority
     * @param authority The authority to check (e.g., "ROLE_ADMIN")
     * @return true if user has the authority
     */
    public static boolean hasAuthority(String authority) {
        return getCurrentAuthorities().contains(authority);
    }
}

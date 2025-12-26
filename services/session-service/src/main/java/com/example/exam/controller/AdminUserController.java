package com.example.exam.controller;

import com.example.exam.model.UserShadowEntity;
import com.example.exam.repository.UserShadowRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * @deprecated As of 2025-12-26, admin user management is not actively used.
 * User management is handled through external auth service.
 * This will be removed in a future version.
 */
@Deprecated
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@Slf4j
public class AdminUserController {
    
    private final UserShadowRepository userShadowRepository;

    /**
     * List users (Admin)
     */
    @GetMapping
    public ResponseEntity<Page<UserDto>> getUsers(Pageable pageable) {
        log.info("Fetching users list: page={}, size={}", pageable.getPageNumber(), pageable.getPageSize());
        Page<UserShadowEntity> users = userShadowRepository.findAll(pageable);
        
        Page<UserDto> userDtos = users.map(user -> new UserDto(
            user.getUserId(),
            user.getUsername(),
            user.getEmail(),
            java.util.Collections.singletonList(user.getRole()), // Convert single role to list
            user.getEnabled()
        ));
        
        return ResponseEntity.ok(userDtos);
    }
    
    @lombok.Data
    @lombok.AllArgsConstructor
    static class UserDto {
        private String id;
        private String username;
        private String email;
        private java.util.List<String> roles; // Frontend expects array
        private boolean enabled;
    }
}

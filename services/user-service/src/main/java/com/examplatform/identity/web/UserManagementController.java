package com.examplatform.identity.web;

import com.examplatform.identity.domain.RoleName;
import com.examplatform.identity.domain.UserEntity;
import com.examplatform.identity.domain.UserRepository;
import com.examplatform.identity.service.IdentityService;
import com.examplatform.identity.web.dto.UserResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * User Management Controller
 * 
 * Provides endpoints for user search and listing
 * Used by Proctor Dashboard and Admin panels
 */
@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:3000"})
public class UserManagementController {

    private final UserRepository userRepository;
    private final IdentityService identityService;

    public UserManagementController(UserRepository userRepository, IdentityService identityService) {
        this.userRepository = userRepository;
        this.identityService = identityService;
    }

    /**
     * List all users with pagination
     */
    @GetMapping
    public ResponseEntity<Page<UserResponse>> listUsers(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestParam(value = "role", required = false) String role
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("username").ascending());
        
        Page<UserEntity> users;
        if (role != null) {
            try {
                RoleName roleName = RoleName.valueOf(role.toUpperCase());
                users = userRepository.findByRolesRoleName(roleName, pageable);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().build();
            }
        } else {
            users = userRepository.findAll(pageable);
        }

        return ResponseEntity.ok(users.map(this::toResponse));
    }

    /**
     * Search users by name or email
     */
    @GetMapping("/search")
    public ResponseEntity<List<UserResponse>> searchUsers(
            @RequestParam("q") String query,
            @RequestParam(value = "limit", defaultValue = "10") int limit
    ) {
        List<UserEntity> users = userRepository
            .findByUsernameContainingIgnoreCaseOrEmailContainingIgnoreCase(query, query);
        
        return ResponseEntity.ok(
            users.stream()
                .limit(limit)
                .map(this::toResponse)
                .collect(Collectors.toList())
        );
    }

    /**
     * Get users by IDs (batch lookup)
     */
    @PostMapping("/batch")
    public ResponseEntity<List<UserResponse>> getUsersByIds(@RequestBody List<String> userIds) {
        List<java.util.UUID> uuids = userIds.stream()
            .map(java.util.UUID::fromString)
            .collect(Collectors.toList());
            
        List<UserEntity> users = userRepository.findAllById(uuids);
        
        return ResponseEntity.ok(
            users.stream()
                .map(this::toResponse)
                .collect(Collectors.toList())
        );
    }

    private UserResponse toResponse(UserEntity entity) {
        return new UserResponse(
            entity.getId() != null ? entity.getId().toString() : null,
            entity.getUsername(),
            entity.getEmail(),
            entity.isEnabled(),
            entity.getRoles().stream()
                .map(role -> "ROLE_" + role.getRoleName().name())
                .collect(java.util.stream.Collectors.toSet())
        );
    }
}

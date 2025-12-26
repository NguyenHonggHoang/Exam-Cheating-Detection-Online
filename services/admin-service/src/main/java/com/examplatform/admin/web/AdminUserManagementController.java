package com.examplatform.admin.web;

import com.examplatform.admin.service.UserManagementService;
import com.examplatform.admin.web.dto.CreateUserRequest;
import com.examplatform.admin.web.dto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserManagementController {

    private final UserManagementService userManagementService;

    public AdminUserManagementController(UserManagementService userManagementService) {
        this.userManagementService = userManagementService;
    }

    @PostMapping
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserRequest request, @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(userManagementService.createUser(request, jwt));
    }

    @GetMapping
    public ResponseEntity<Object> listUsers(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "10") int size,
            @RequestParam(value = "role", required = false) String role,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return ResponseEntity.ok(userManagementService.listUsers(page, size, role, jwt));
    }
}
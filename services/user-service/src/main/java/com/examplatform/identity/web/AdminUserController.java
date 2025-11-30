package com.examplatform.identity.web;

import com.examplatform.identity.service.IdentityService;
import com.examplatform.identity.web.dto.CreateUserRequest;
import com.examplatform.identity.web.dto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/internal/users")
public class AdminUserController {

    private final IdentityService identityService;

    public AdminUserController(IdentityService identityService) {
        this.identityService = identityService;
    }

    @PostMapping
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserResponse user = identityService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }

    @org.springframework.web.bind.annotation.GetMapping("/{userId}")
    public ResponseEntity<UserResponse> getUserById(@org.springframework.web.bind.annotation.PathVariable java.util.UUID userId) {
        UserResponse user = identityService.findById(userId);
        return ResponseEntity.ok(user);
    }
}


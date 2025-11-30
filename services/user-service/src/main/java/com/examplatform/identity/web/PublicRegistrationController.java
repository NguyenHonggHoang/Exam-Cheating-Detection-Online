package com.examplatform.identity.web;

import com.examplatform.identity.service.IdentityService;
import com.examplatform.identity.web.dto.RegisterRequest;
import com.examplatform.identity.web.dto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class PublicRegistrationController {

    private final IdentityService identityService;

    public PublicRegistrationController(IdentityService identityService) {
        this.identityService = identityService;
    }

    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        UserResponse user = identityService.registerCandidate(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }
}


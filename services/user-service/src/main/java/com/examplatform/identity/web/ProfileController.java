package com.examplatform.identity.web;

import com.examplatform.identity.service.IdentityService;
import com.examplatform.identity.web.dto.UserResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class ProfileController {

    private final IdentityService identityService;

    public ProfileController(IdentityService identityService) {
        this.identityService = identityService;
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal Jwt jwt) {
        String username = resolveUsername(jwt);
        return identityService.findByUsername(username);
    }

    private String resolveUsername(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalStateException("Missing JWT principal");
        }
        if (jwt.hasClaim("preferred_username")) {
            return jwt.getClaimAsString("preferred_username");
        }
        return jwt.getSubject();
    }
}


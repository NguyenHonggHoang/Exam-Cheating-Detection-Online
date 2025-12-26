package com.examplatform.identity.web;

import com.examplatform.identity.domain.RoleName;
import com.examplatform.identity.service.IdentityService;
import com.examplatform.identity.web.dto.CreateUserRequest;
import com.examplatform.identity.web.dto.ResetPasswordRequest;
import com.examplatform.identity.web.dto.UpdateUserRequest;
import com.examplatform.identity.web.dto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserManagementController {

    private final IdentityService identityService;

    public AdminUserManagementController(IdentityService identityService) {
        this.identityService = identityService;
    }

    @PostMapping
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        // Assuming IdentityService.createUser handles CreateUserRequest properly
        return ResponseEntity.ok(identityService.createUser(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserResponse> updateUser(@PathVariable UUID id, @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(identityService.updateUser(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable UUID id) {
        identityService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reset-password")
    public ResponseEntity<Void> resetPassword(@PathVariable UUID id, @RequestBody ResetPasswordRequest request) {
        identityService.resetPassword(id, request.newPassword());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/roles")
    public ResponseEntity<UserResponse> assignRole(@PathVariable UUID id, @RequestBody Map<String, String> payload) {
        String roleStr = payload.get("role");
        if (roleStr == null) {
            return ResponseEntity.badRequest().build();
        }
        try {
            RoleName role = RoleName.valueOf(roleStr);
            return ResponseEntity.ok(identityService.assignRole(id, role));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/export")
    public ResponseEntity<ByteArrayResource> exportUsers(@RequestParam(required = false) String role) {
        RoleName roleFilter = null;
        if (role != null && !role.isEmpty()) {
            try {
                roleFilter = RoleName.valueOf(role);
            } catch (IllegalArgumentException e) {
                 // Ignore or bad request
            }
        }

        List<UserResponse> users = identityService.findAll(roleFilter);
        
        StringBuilder csv = new StringBuilder();
        csv.append("ID,Username,Email,Enabled,Roles\n");
        for (UserResponse user : users) {
            csv.append(user.id()).append(",")
               .append(escape(user.username())).append(",")
               .append(escape(user.email())).append(",")
               .append(user.enabled()).append(",")
               .append(String.join("|", user.authorities())).append("\n");
        }

        byte[] bytes = csv.toString().getBytes(StandardCharsets.UTF_8);
        ByteArrayResource resource = new ByteArrayResource(bytes);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=users.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .contentLength(bytes.length)
                .body(resource);
    }
    
    private String escape(String s) {
        if (s == null) return "";
        if (s.contains(",") || s.contains("\"") || s.contains("\n")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }
}

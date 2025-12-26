package com.example.exam.controller;

import com.example.exam.entity.StudentProfile;
import com.example.exam.service.StudentProfileService;
import com.example.exam.service.StudentProfileService.ProfileResponse;
import com.example.exam.service.StudentProfileService.UpdateProfileRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Student Profile Controller
 * 
 * Endpoints for managing student profile data (faculty, class, batch year).
 * 
 * @deprecated As of 2025-12-26, student profile management has minimal usage.
 * Profile features may be migrated to user service or removed.
 * This will be removed in a future version.
 */
@Deprecated
@RestController
@RequestMapping("/api/users")
public class StudentProfileController {
    
    private static final Logger log = LoggerFactory.getLogger(StudentProfileController.class);
    
    private final StudentProfileService profileService;
    
    public StudentProfileController(StudentProfileService profileService) {
        this.profileService = profileService;
    }
    
    /**
     * Get current user's profile
     */
    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(@AuthenticationPrincipal Jwt jwt) {
        String userId = extractUserId(jwt);
        
        return profileService.getProfile(userId)
                .<ResponseEntity<?>>map(profile -> ResponseEntity.ok(ProfileResponse.from(profile)))
                .orElseGet(() -> ResponseEntity.ok(Map.of(
                        "userId", userId,
                        "profileCompleted", false,
                        "message", "Profile not found"
                )));
    }
    
    /**
     * Check if profile is completed
     */
    @GetMapping("/profile/status")
    public ResponseEntity<?> getProfileStatus(@AuthenticationPrincipal Jwt jwt) {
        String userId = extractUserId(jwt);
        
        boolean completed = profileService.isProfileCompleted(userId);
        
        return ResponseEntity.ok(Map.of(
                "userId", userId,
                "profileCompleted", completed
        ));
    }
    
    /**
     * Update student profile
     */
    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody ProfileUpdateBody body) {
        
        String userId = extractUserId(jwt);
        log.info("[Profile] Updating profile for user {}", userId);
        
        UpdateProfileRequest request = new UpdateProfileRequest(
                body.fullName,
                body.studentId,
                body.faculty,
                body.className,
                body.batchYear,
                body.department
        );
        
        StudentProfile updated = profileService.updateProfile(userId, request);
        
        return ResponseEntity.ok(Map.of(
                "success", true,
                "profile", ProfileResponse.from(updated)
        ));
    }
    
    /**
     * Extract user ID from JWT
     */
    private String extractUserId(Jwt jwt) {
        // Try different claims for user ID
        if (jwt.hasClaim("sub")) {
            return jwt.getClaimAsString("sub");
        }
        if (jwt.hasClaim("user_id")) {
            return jwt.getClaimAsString("user_id");
        }
        throw new IllegalStateException("Cannot extract user ID from JWT");
    }
    
    static class ProfileUpdateBody {
        public String fullName;
        public String studentId;
        public String faculty;
        public String className;
        public Integer batchYear;
        public String department;
    }
}

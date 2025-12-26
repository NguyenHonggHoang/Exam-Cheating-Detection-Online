package com.example.exam.controller;

import com.example.exam.entity.VerificationEscalation;
import com.example.exam.service.VerificationEscalationService;
import com.example.exam.service.VerificationEscalationService.EscalationDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Verification Escalation Controller
 * 
 * Endpoints for:
 * - Students to create escalation requests
 * - Proctors to view and review escalations
 * 
 * @deprecated As of 2025-12-26, verification escalation workflow is not fully implemented.
 * Manual verification is handled through proctor dashboard.
 * This will be removed in a future version.
 */
@Deprecated
@RestController
@RequestMapping("/api/identity/verify")
public class VerificationEscalationController {
    
    private static final Logger log = LoggerFactory.getLogger(VerificationEscalationController.class);
    
    private final VerificationEscalationService escalationService;
    
    public VerificationEscalationController(VerificationEscalationService escalationService) {
        this.escalationService = escalationService;
    }
    
    /**
     * Create escalation request after failed automatic verification
     * Called by frontend after 5 failed attempts
     */
    @PostMapping("/escalate")
    public ResponseEntity<?> createEscalation(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody EscalateRequest request) {
        
        String userId = extractUserId(jwt);
        log.info("[Escalation] Creating escalation for session={}, user={}", request.sessionId, userId);
        
        VerificationEscalation escalation = escalationService.createEscalation(
                request.sessionId,
                userId,
                request.snapshotObjectKey,
                request.reason,
                request.attemptCount
        );
        
        return ResponseEntity.ok(Map.of(
                "success", true,
                "escalationId", escalation.getId(),
                "status", escalation.getStatus().name(),
                "message", "Escalation created. Waiting for proctor review."
        ));
    }
    
    /**
     * Get escalation status for a session
     * Used by frontend to poll for proctor decision
     */
    @GetMapping("/escalation-status/{sessionId}")
    public ResponseEntity<?> getEscalationStatus(@PathVariable UUID sessionId) {
        return escalationService.getEscalationStatus(sessionId)
                .map(escalation -> ResponseEntity.ok(Map.of(
                        "id", escalation.getId(),
                        "status", escalation.getStatus().name(),
                        "proctorId", escalation.getProctorId() != null ? escalation.getProctorId() : "",
                        "proctorNote", escalation.getProctorNote() != null ? escalation.getProctorNote() : "",
                        "reviewedAt", escalation.getReviewedAt() != null ? escalation.getReviewedAt().toString() : null
                )))
                .orElse(ResponseEntity.ok(Map.of(
                        "status", "NOT_FOUND",
                        "message", "No escalation found for this session"
                )));
    }
    
    // ========== Proctor Endpoints ==========
    
    /**
     * Get all pending escalations for proctor dashboard
     */
    @GetMapping("/escalations/pending")
    @PreAuthorize("hasAnyRole('PROCTOR', 'ADMIN')")
    public ResponseEntity<List<EscalationDto>> getPendingEscalations() {
        List<EscalationDto> pending = escalationService.getPendingEscalations();
        return ResponseEntity.ok(pending);
    }
    
    /**
     * Proctor approves escalation
     */
    @PostMapping("/escalations/{escalationId}/approve")
    @PreAuthorize("hasAnyRole('PROCTOR', 'ADMIN')")
    public ResponseEntity<?> approveEscalation(
            @PathVariable UUID escalationId,
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody(required = false) ReviewBody body) {
        
        String proctorId = extractUserId(jwt);
        String note = body != null ? body.note : null;
        
        log.info("[Escalation] Proctor {} approving escalation {}", proctorId, escalationId);
        
        VerificationEscalation approved = escalationService.approve(escalationId, proctorId, note);
        
        return ResponseEntity.ok(Map.of(
                "success", true,
                "escalationId", approved.getId(),
                "status", approved.getStatus().name()
        ));
    }
    
    /**
     * Proctor rejects escalation
     */
    @PostMapping("/escalations/{escalationId}/reject")
    @PreAuthorize("hasAnyRole('PROCTOR', 'ADMIN')")
    public ResponseEntity<?> rejectEscalation(
            @PathVariable UUID escalationId,
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody(required = false) ReviewBody body) {
        
        String proctorId = extractUserId(jwt);
        String note = body != null ? body.note : null;
        
        log.info("[Escalation] Proctor {} rejecting escalation {}", proctorId, escalationId);
        
        VerificationEscalation rejected = escalationService.reject(escalationId, proctorId, note);
        
        return ResponseEntity.ok(Map.of(
                "success", true,
                "escalationId", rejected.getId(),
                "status", rejected.getStatus().name()
        ));
    }
    
    /**
     * Extract user ID from JWT
     */
    private String extractUserId(Jwt jwt) {
        if (jwt.hasClaim("sub")) {
            return jwt.getClaimAsString("sub");
        }
        if (jwt.hasClaim("user_id")) {
            return jwt.getClaimAsString("user_id");
        }
        throw new IllegalStateException("Cannot extract user ID from JWT");
    }
    
    static class EscalateRequest {
        public UUID sessionId;
        public String userId;
        public String snapshotObjectKey;
        public String reason;
        public Integer attemptCount;
    }
    
    static class ReviewBody {
        public String note;
    }
}

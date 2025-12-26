package com.example.exam.service;

import com.example.exam.entity.StudentIdentityPhoto;
import com.example.exam.entity.VerificationEscalation;
import com.example.exam.repository.StudentIdentityPhotoRepository;
import com.example.exam.repository.VerificationEscalationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Verification Escalation Service
 * 
 * Handles escalation of failed automatic verifications to proctors.
 * Used when a student fails face verification after 5 attempts.
 * 
 * @deprecated As of 2025-12-26, verification escalation workflow is not fully implemented.
 * Tied to deprecated VerificationEscalationController.
 * This will be removed in a future version.
 */
@Deprecated
@Service
public class VerificationEscalationService {
    
    private static final Logger log = LoggerFactory.getLogger(VerificationEscalationService.class);
    
    @Value("${verification.escalation.expiry-minutes:10}")
    private int escalationExpiryMinutes;
    
    private final VerificationEscalationRepository escalationRepository;
    private final StudentIdentityPhotoRepository idPhotoRepository;
    private final StorageService storageService;
    private final WebSocketNotificationService wsNotificationService;
    
    public VerificationEscalationService(
            VerificationEscalationRepository escalationRepository,
            StudentIdentityPhotoRepository idPhotoRepository,
            StorageService storageService,
            WebSocketNotificationService wsNotificationService) {
        this.escalationRepository = escalationRepository;
        this.idPhotoRepository = idPhotoRepository;
        this.storageService = storageService;
        this.wsNotificationService = wsNotificationService;
    }
    
    /**
     * Create escalation request after failed automatic verification
     */
    @Transactional
    public VerificationEscalation createEscalation(
            UUID sessionId,
            String userId,
            String snapshotObjectKey,
            String reason,
            Integer attemptCount) {
        
        log.info("[Escalation] Creating escalation for session={}, user={}", sessionId, userId);
        
        // Get user's ID photo for comparison
        String idPhotoKey = idPhotoRepository.findByUserId(userId)
                .map(StudentIdentityPhoto::getObjectKey)
                .orElse(null);
        
        VerificationEscalation escalation = new VerificationEscalation();
        escalation.setSessionId(sessionId);
        escalation.setUserId(userId);
        escalation.setSnapshotObjectKey(snapshotObjectKey);
        escalation.setIdPhotoObjectKey(idPhotoKey);
        escalation.setReason(reason);
        escalation.setAttemptCount(attemptCount != null ? attemptCount : 5);
        escalation.setStatus(VerificationEscalation.Status.PENDING);
        escalation.setExpiresAt(Instant.now().plus(Duration.ofMinutes(escalationExpiryMinutes)));
        
        VerificationEscalation saved = escalationRepository.save(escalation);
        log.info("[Escalation] Created escalation id={}", saved.getId());
        
        // Send WebSocket notification to proctors
        try {
            wsNotificationService.notifyNewEscalation(saved.getId(), sessionId, userId, reason);
        } catch (Exception e) {
            log.warn("Failed to send escalation notification", e);
        }
        
        return saved;
    }
    
    /**
     * Get escalation status for a session
     */
    public Optional<VerificationEscalation> getEscalationStatus(UUID sessionId) {
        return escalationRepository.findFirstBySessionIdOrderByCreatedAtDesc(sessionId);
    }
    
    /**
     * Get all pending escalations for proctor dashboard
     */
    public List<EscalationDto> getPendingEscalations() {
        return escalationRepository.findPendingEscalations()
                .stream()
                .map(this::toDto)
                .toList();
    }
    
    /**
     * Proctor approves the escalation
     */
    @Transactional
    public VerificationEscalation approve(UUID escalationId, String proctorId, String note) {
        VerificationEscalation escalation = escalationRepository.findById(escalationId)
                .orElseThrow(() -> new IllegalArgumentException("Escalation not found: " + escalationId));
        
        if (escalation.getStatus() != VerificationEscalation.Status.PENDING) {
            throw new IllegalStateException("Escalation already reviewed");
        }
        
        escalation.setStatus(VerificationEscalation.Status.APPROVED);
        escalation.setProctorId(proctorId);
        escalation.setProctorNote(note);
        escalation.setReviewedAt(Instant.now());
        
        log.info("[Escalation] Approved escalation id={} by proctor={}", escalationId, proctorId);
        
        VerificationEscalation saved = escalationRepository.save(escalation);
        
        // Send WebSocket notification to student
        try {
            wsNotificationService.notifyEscalationDecision(
                saved.getSessionId(), 
                saved.getUserId(), 
                "APPROVED", 
                note
            );
        } catch (Exception e) {
            log.warn("Failed to send escalation decision notification", e);
        }
        
        return saved;
    }
    
    /**
     * Proctor rejects the escalation
     */
    @Transactional
    public VerificationEscalation reject(UUID escalationId, String proctorId, String note) {
        VerificationEscalation escalation = escalationRepository.findById(escalationId)
                .orElseThrow(() -> new IllegalArgumentException("Escalation not found: " + escalationId));
        
        if (escalation.getStatus() != VerificationEscalation.Status.PENDING) {
            throw new IllegalStateException("Escalation already reviewed");
        }
        
        escalation.setStatus(VerificationEscalation.Status.REJECTED);
        escalation.setProctorId(proctorId);
        escalation.setProctorNote(note);
        escalation.setReviewedAt(Instant.now());
        
        log.info("[Escalation] Rejected escalation id={} by proctor={}", escalationId, proctorId);
        
        VerificationEscalation saved = escalationRepository.save(escalation);
        
        // Send WebSocket notification to student
        try {
            wsNotificationService.notifyEscalationDecision(
                saved.getSessionId(), 
                saved.getUserId(), 
                "REJECTED", 
                note
            );
        } catch (Exception e) {
            log.warn("Failed to send escalation decision notification", e);
        }
        
        return saved;
    }
    
    /**
     * Convert entity to DTO with presigned URLs for photo display
     */
    private EscalationDto toDto(VerificationEscalation escalation) {
        String snapshotUrl = null;
        String idPhotoUrl = null;
        
        try {
            if (escalation.getSnapshotObjectKey() != null) {
                snapshotUrl = storageService.getPresignedUrl(escalation.getSnapshotObjectKey());
            }
            if (escalation.getIdPhotoObjectKey() != null) {
                idPhotoUrl = storageService.getPresignedUrl(escalation.getIdPhotoObjectKey());
            }
        } catch (Exception e) {
            log.warn("Failed to generate presigned URLs for escalation {}", escalation.getId(), e);
        }
        
        return new EscalationDto(
                escalation.getId(),
                escalation.getSessionId(),
                escalation.getUserId(),
                snapshotUrl,
                idPhotoUrl,
                escalation.getReason(),
                escalation.getAttemptCount(),
                escalation.getStatus().name(),
                escalation.getCreatedAt(),
                escalation.getExpiresAt()
        );
    }
    
    /**
     * DTO for escalation response
     */
    public record EscalationDto(
            UUID id,
            UUID sessionId,
            String userId,
            String snapshotUrl,
            String idPhotoUrl,
            String reason,
            Integer attemptCount,
            String status,
            Instant createdAt,
            Instant expiresAt
    ) {}
}

package com.example.exam.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * Verification Escalation - Manual verification requests for proctors
 * 
 * Created when automatic face verification fails after 5 attempts.
 * Proctor can approve/reject based on manual comparison of photos.
 */
@Entity
@Table(name = "verification_escalations")
public class VerificationEscalation {
    
    public enum Status {
        PENDING,    // Awaiting proctor review
        APPROVED,   // Proctor approved
        REJECTED,   // Proctor rejected
        EXPIRED     // Timed out without decision
    }
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @Column(name = "session_id", nullable = false)
    private UUID sessionId;
    
    @Column(name = "user_id", nullable = false)
    private String userId;
    
    @Column(name = "snapshot_object_key", nullable = false)
    private String snapshotObjectKey;
    
    @Column(name = "id_photo_object_key")
    private String idPhotoObjectKey;
    
    @Column(name = "reason")
    private String reason;
    
    @Column(name = "attempt_count")
    private Integer attemptCount = 5;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.PENDING;
    
    @Column(name = "proctor_id")
    private String proctorId;
    
    @Column(name = "proctor_note")
    private String proctorNote;
    
    @Column(name = "reviewed_at")
    private Instant reviewedAt;
    
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
    
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
    
    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    
    public UUID getSessionId() { return sessionId; }
    public void setSessionId(UUID sessionId) { this.sessionId = sessionId; }
    
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public String getSnapshotObjectKey() { return snapshotObjectKey; }
    public void setSnapshotObjectKey(String snapshotObjectKey) { this.snapshotObjectKey = snapshotObjectKey; }
    
    public String getIdPhotoObjectKey() { return idPhotoObjectKey; }
    public void setIdPhotoObjectKey(String idPhotoObjectKey) { this.idPhotoObjectKey = idPhotoObjectKey; }
    
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    
    public Integer getAttemptCount() { return attemptCount; }
    public void setAttemptCount(Integer attemptCount) { this.attemptCount = attemptCount; }
    
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    
    public String getProctorId() { return proctorId; }
    public void setProctorId(String proctorId) { this.proctorId = proctorId; }
    
    public String getProctorNote() { return proctorNote; }
    public void setProctorNote(String proctorNote) { this.proctorNote = proctorNote; }
    
    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }
    
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
}

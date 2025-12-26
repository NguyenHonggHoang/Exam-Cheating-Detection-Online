package com.example.exam.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Incident Entity - Incident Service
 * 
 * Stores violation incidents detected by frontend AI or server AI
 */
@Entity
@Table(
    name = "incidents",
    indexes = {
        @Index(name = "idx_incident_session_id", columnList = "session_id"),
        @Index(name = "idx_incident_type", columnList = "type"),
        @Index(name = "idx_incident_severity", columnList = "severity"),
        @Index(name = "idx_incident_status", columnList = "status"),
        @Index(name = "idx_incident_detected_at", columnList = "detected_at"),
        @Index(name = "idx_incident_detected_by", columnList = "detected_by")
    }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Incident {
    
    @Id
    @Column(name = "id", nullable = false)
    private UUID id;
    
    @Column(name = "session_id", nullable = false)
    private UUID sessionId;
    
    @Column(name = "type", nullable = false, length = 100)
    private String type;  // MULTIPLE_FACES, NO_FACE, LOOKING_AWAY, etc.
    
    @Column(name = "severity", nullable = false, length = 50)
    private String severity;  // LOW, MEDIUM, HIGH
    
    @Column(name = "status", nullable = false, length = 50)
    private String status = "PENDING";  // PENDING, UNDER_REVIEW, REVIEWED, DISMISSED, ESCALATED
    
    @Column(name = "evidence_url", length = 1000)
    private String evidenceUrl;
    
    @Column(name = "object_key", length = 500)
    private String objectKey;
    
    @Column(name = "file_size")
    private Long fileSize;
    
    @Column(name = "detected_by", nullable = false, length = 50)
    private String detectedBy;  // FRONTEND_AI, SERVER_AI, PROCTOR
    
    @Column(name = "detected_at", nullable = false)
    private Instant detectedAt;
    
    @Column(name = "reviewed_at")
    private Instant reviewedAt;
    
    @Column(name = "reviewed_by", length = 255)
    private String reviewedBy;
    
    @Column(name = "consecutive_count")
    private Integer consecutiveCount;
    
    @Column(name = "first_detected_at")
    private Instant firstDetectedAt;
    
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
    
    /**
     * Helper: Check if incident is pending review
     */
    public boolean isPending() {
        return "PENDING".equals(status);
    }
    
    /**
     * Helper: Check if incident is reviewed
     */
    public boolean isReviewed() {
        return "REVIEWED".equals(status) || "DISMISSED".equals(status);
    }
}

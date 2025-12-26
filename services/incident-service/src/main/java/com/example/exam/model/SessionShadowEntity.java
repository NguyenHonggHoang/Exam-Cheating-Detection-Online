package com.example.exam.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Session Shadow Entity - Local cache of session data from session_db
 * 
 * Synced via CDC from session_db.sessions table
 * 
 * Purpose: Track active sessions for incident correlation
 * Use Case: Auto-close incidents when session ends, validate incident session references
 */
@Entity
@Table(name = "session_shadow")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SessionShadowEntity {

    @Id
    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(name = "user_id", nullable = false, length = 255)
    private String userId;

    @Column(name = "exam_id", nullable = false)
    private UUID examId;

    @Column(name = "status", nullable = false, length = 20)
    private String status; // ACTIVE, ENDED, ABORTED

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(name = "deleted", nullable = false)
    private Boolean deleted = false;

    @Column(name = "synced_at", nullable = false)
    private Instant syncedAt = Instant.now();

    /**
     * Update fields from CDC event
     */
    public void updateFrom(String userId, UUID examId, String status, Instant startedAt, Instant endedAt) {
        this.userId = userId;
        this.examId = examId;
        this.status = status;
        this.startedAt = startedAt;
        this.endedAt = endedAt;
        this.deleted = false;
        this.syncedAt = Instant.now();
    }

    /**
     * Mark as deleted (soft delete)
     */
    public void markDeleted() {
        this.deleted = true;
        this.syncedAt = Instant.now();
    }

    /**
     * Check if session is active
     */
    public boolean isActive() {
        return "ACTIVE".equalsIgnoreCase(status) && !deleted;
    }

    /**
     * Check if session is ended
     */
    public boolean isEnded() {
        return ("ENDED".equalsIgnoreCase(status) || "ABORTED".equalsIgnoreCase(status)) && !deleted;
    }
}

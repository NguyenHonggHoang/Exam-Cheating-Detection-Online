package com.example.exam.repository;

import com.example.exam.model.Incident;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Incident Repository - Enhanced for filtering
 */
@Repository
public interface IncidentRepository extends JpaRepository<Incident, UUID> {
    
    // Basic queries
    List<Incident> findBySessionId(UUID sessionId);
    Page<Incident> findBySessionId(UUID sessionId, Pageable pageable);
    
    // Idempotency check for incoming events
    Optional<Incident> findBySessionIdAndTypeAndDetectedAt(UUID sessionId, String type, Instant detectedAt);
    
    // Severity filtering
    Page<Incident> findBySeverity(String severity, Pageable pageable);
    Page<Incident> findBySessionIdAndSeverity(UUID sessionId, String severity, Pageable pageable);
    
    // Status filtering
    Page<Incident> findByStatus(String status, Pageable pageable);
    Page<Incident> findBySessionIdAndStatus(UUID sessionId, String status, Pageable pageable);
    
    // Combined filtering
    Page<Incident> findBySeverityAndStatus(String severity, String status, Pageable pageable);
    Page<Incident> findBySessionIdAndSeverityAndStatus(UUID sessionId, String severity, String status, Pageable pageable);
    
    // Multi-session queries (for examId filtering via shadow table)
    List<Incident> findBySessionIdIn(List<UUID> sessionIds);
    Page<Incident> findBySessionIdIn(List<UUID> sessionIds, Pageable pageable);
    Page<Incident> findBySessionIdInAndSeverity(List<UUID> sessionIds, String severity, Pageable pageable);
    Page<Incident> findBySessionIdInAndStatus(List<UUID> sessionIds, String status, Pageable pageable);
    Page<Incident> findBySessionIdInAndSeverityAndStatus(List<UUID> sessionIds, String severity, String status, Pageable pageable);
    
    // Count queries for statistics
    long countBySessionId(UUID sessionId);
    long countBySeverity(String severity);
    long countByStatus(String status);

    // Count queries for multi-session summary (used by getSummary with examId filter)
    long countBySessionIdIn(List<UUID> sessionIds);
    long countBySessionIdInAndStatus(List<UUID> sessionIds, String status);
    long countBySessionIdInAndSeverity(List<UUID> sessionIds, String severity);

    // ---- Auto-close support (called when session ends via CDC) ----

    /**
     * Find open incidents for a session (used by auto-close on session end).
     * Runs on the primary datasource inside a write transaction.
     */
    List<Incident> findBySessionIdAndStatus(UUID sessionId, String status);

    /**
     * Bulk-update all PENDING incidents for a session to a target status.
     * Single UPDATE statement — far more efficient than load-iterate-save.
     *
     * @param sessionId   the session that ended
     * @param targetStatus new status (e.g. "SESSION_ENDED")
     * @param closedAt    timestamp to set as reviewed_at
     * @return number of rows updated
     */
    @Modifying
    @Query("""
        UPDATE Incident i
        SET i.status    = :targetStatus,
            i.reviewedAt = :closedAt
        WHERE i.sessionId = :sessionId
          AND i.status    = 'PENDING'
        """)
    int bulkCloseBySessionId(@Param("sessionId") UUID sessionId,
                             @Param("targetStatus") String targetStatus,
                             @Param("closedAt") Instant closedAt);
}

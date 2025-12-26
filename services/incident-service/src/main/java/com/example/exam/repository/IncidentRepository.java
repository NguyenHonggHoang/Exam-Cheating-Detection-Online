package com.example.exam.repository;

import com.example.exam.model.Incident;
import com.example.exam.model.SessionShadowEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
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
}

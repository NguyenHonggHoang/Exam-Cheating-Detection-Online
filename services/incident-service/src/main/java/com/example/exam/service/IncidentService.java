package com.example.exam.service;

import com.example.exam.dto.IncidentDto;
import com.example.exam.model.Incident;
import com.example.exam.model.SessionShadowEntity;
import com.example.exam.repository.IncidentRepository;
import com.example.exam.repository.SessionShadowRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Incident Service - Business Logic
 * 
 * Handles incident management with shadow table queries
 */
@Service
@RequiredArgsConstructor
public class IncidentService {

    private static final Logger log = LoggerFactory.getLogger(IncidentService.class);

    private final IncidentRepository incidentRepository;
    private final SessionShadowRepository sessionShadowRepository;

    /**
     * Find incidents with complex filtering and tenant isolation
     * 
     * Uses shadow tables for cross-service data
     */
    @Transactional(readOnly = true)
    public Page<Incident> findIncidents(
            UUID sessionId,
            String examId,
            String severity,
            String status,
            UUID userId,
            boolean isStudent,
            Pageable pageable
    ) {
        // Enforce STUDENT isolation
        if (isStudent) {
            if (sessionId != null) {
                // Verify ownership
                if (!sessionShadowRepository.isSessionOwnedByUser(sessionId, userId)) {
                    throw new org.springframework.security.access.AccessDeniedException("You do not have permission to view incidents for this session.");
                }
            } else {
                // If student doesn't provide a session, force query to only their sessions
                List<UUID> ownedSessionIds = sessionShadowRepository.findSessionsByUser(userId)
                    .stream().map(SessionShadowEntity::getSessionId).collect(Collectors.toList());
                
                if (ownedSessionIds.isEmpty()) return Page.empty(pageable);
                
                if (severity != null && status != null) {
                    return incidentRepository.findBySessionIdInAndSeverityAndStatus(ownedSessionIds, severity, status, pageable);
                } else if (severity != null) {
                    return incidentRepository.findBySessionIdInAndSeverity(ownedSessionIds, severity, pageable);
                } else if (status != null) {
                    return incidentRepository.findBySessionIdInAndStatus(ownedSessionIds, status, pageable);
                } else {
                    return incidentRepository.findBySessionIdIn(ownedSessionIds, pageable);
                }
            }
        }

        // Case 1: Filter by sessionId (direct query)
        if (sessionId != null) {
            if (severity != null && status != null) {
                return incidentRepository.findBySessionIdAndSeverityAndStatus(
                    sessionId, severity, status, pageable
                );
            } else if (severity != null) {
                return incidentRepository.findBySessionIdAndSeverity(
                    sessionId, severity, pageable
                );
            } else if (status != null) {
                return incidentRepository.findBySessionIdAndStatus(
                    sessionId, status, pageable
                );
            } else {
                return incidentRepository.findBySessionId(sessionId, pageable);
            }
        }

        // Case 2: Filter by examId (requires shadow table join)
        if (examId != null) {
            // Get all sessions for this exam from shadow table
            List<UUID> sessionIds = sessionShadowRepository.findSessionsByExam(UUID.fromString(examId))
                .stream()
                .filter(s -> !s.getDeleted())
                .map(SessionShadowEntity::getSessionId)
                .collect(Collectors.toList());

            if (sessionIds.isEmpty()) {
                return Page.empty(pageable);
            }

            // Query incidents for these sessions
            if (severity != null && status != null) {
                return incidentRepository.findBySessionIdInAndSeverityAndStatus(
                    sessionIds, severity, status, pageable
                );
            } else if (severity != null) {
                return incidentRepository.findBySessionIdInAndSeverity(
                    sessionIds, severity, pageable
                );
            } else if (status != null) {
                return incidentRepository.findBySessionIdInAndStatus(
                    sessionIds, status, pageable
                );
            } else {
                return incidentRepository.findBySessionIdIn(sessionIds, pageable);
            }
        }

        // Case 3: No session/exam filter, just severity/status
        if (severity != null && status != null) {
            return incidentRepository.findBySeverityAndStatus(severity, status, pageable);
        } else if (severity != null) {
            return incidentRepository.findBySeverity(severity, pageable);
        } else if (status != null) {
            return incidentRepository.findByStatus(status, pageable);
        }

        // Case 4: No filters, return all
        return incidentRepository.findAll(pageable);
    }

    /**
     * Update incident status
     */
    @Transactional
    public Incident updateStatus(UUID incidentId, String newStatus, String notes) {
        Incident incident = incidentRepository.findById(incidentId)
            .orElseThrow(() -> new IllegalArgumentException("Incident not found: " + incidentId));

        incident.setStatus(newStatus);
        
        if (notes != null) {
            // Assuming Incident has a notes field
            // incident.setNotes(notes);
        }

        // If status is REVIEWED, set reviewed timestamp
        if ("REVIEWED".equals(newStatus)) {
            incident.setReviewedAt(Instant.now());
        }

        return incidentRepository.save(incident);
    }

    /**
     * Get incident summary statistics.
     *
     * Uses dedicated count queries instead of loading all Incident entities
     * into the heap — critical when a single exam session can generate
     * thousands of incidents.
     */
    @Transactional(readOnly = true)
    public IncidentDto.SummaryResponse getSummary(String examId, UUID sessionId) {

        if (sessionId != null) {
            // Fast path: single session — all counts in one DB round-trip each
            return buildSummaryForSessions(List.of(sessionId));
        }

        if (examId != null) {
            List<UUID> sessionIds = sessionShadowRepository
                    .findSessionsByExam(UUID.fromString(examId))
                    .stream()
                    .filter(s -> !s.getDeleted())
                    .map(SessionShadowEntity::getSessionId)
                    .collect(Collectors.toList());

            if (sessionIds.isEmpty()) {
                return IncidentDto.SummaryResponse.builder()
                        .totalIncidents(0L).pendingIncidents(0L)
                        .reviewedIncidents(0L).dismissedIncidents(0L)
                        .lowSeverityCount(0L).mediumSeverityCount(0L)
                        .highSeverityCount(0L).build();
            }
            return buildSummaryForSessions(sessionIds);
        }

        // No filter: global summary — use global count queries, avoid findAll()
        long total    = incidentRepository.count();
        long pending  = incidentRepository.countByStatus("PENDING");
        long reviewed = incidentRepository.countByStatus("REVIEWED");
        long dismissed = incidentRepository.countByStatus("DISMISSED");
        long low      = incidentRepository.countBySeverity("LOW");
        long medium   = incidentRepository.countBySeverity("MEDIUM");
        long high     = incidentRepository.countBySeverity("HIGH");

        return IncidentDto.SummaryResponse.builder()
                .totalIncidents(total)
                .pendingIncidents(pending)
                .reviewedIncidents(reviewed)
                .dismissedIncidents(dismissed)
                .lowSeverityCount(low)
                .mediumSeverityCount(medium)
                .highSeverityCount(high)
                .build();
    }

    /**
     * Build a summary DTO using count queries scoped to specific session IDs.
     * Avoids loading any Incident entities; only COUNT(*) queries hit the DB.
     */
    private IncidentDto.SummaryResponse buildSummaryForSessions(List<UUID> sessionIds) {
        long total     = incidentRepository.countBySessionIdIn(sessionIds);
        long pending   = incidentRepository.countBySessionIdInAndStatus(sessionIds, "PENDING");
        long reviewed  = incidentRepository.countBySessionIdInAndStatus(sessionIds, "REVIEWED");
        long dismissed = incidentRepository.countBySessionIdInAndStatus(sessionIds, "DISMISSED");
        long low       = incidentRepository.countBySessionIdInAndSeverity(sessionIds, "LOW");
        long medium    = incidentRepository.countBySessionIdInAndSeverity(sessionIds, "MEDIUM");
        long high      = incidentRepository.countBySessionIdInAndSeverity(sessionIds, "HIGH");

        return IncidentDto.SummaryResponse.builder()
                .totalIncidents(total)
                .pendingIncidents(pending)
                .reviewedIncidents(reviewed)
                .dismissedIncidents(dismissed)
                .lowSeverityCount(low)
                .mediumSeverityCount(medium)
                .highSeverityCount(high)
                .build();
    }
}

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
     * Find incidents with complex filtering
     * 
     * Uses shadow tables for cross-service data
     */
    @Transactional(readOnly = true)
    public Page<Incident> findIncidents(
            UUID sessionId,
            String examId,
            String severity,
            String status,
            Pageable pageable
    ) {
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
     * Get incident summary statistics
     */
    @Transactional(readOnly = true)
    public IncidentDto.SummaryResponse getSummary(String examId, UUID sessionId) {
        List<Incident> incidents;

        if (examId != null) {
            // Get incidents for all sessions in this exam
            List<UUID> sessionIds = sessionShadowRepository.findSessionsByExam(UUID.fromString(examId))
                .stream()
                .filter(s -> !s.getDeleted())
                .map(SessionShadowEntity::getSessionId)
                .collect(Collectors.toList());

            incidents = incidentRepository.findBySessionIdIn(sessionIds);

        } else if (sessionId != null) {
            incidents = incidentRepository.findBySessionId(sessionId);

        } else {
            incidents = incidentRepository.findAll();
        }

        // Calculate statistics
        long total = incidents.size();
        long pending = incidents.stream().filter(i -> "PENDING".equals(i.getStatus())).count();
        long reviewed = incidents.stream().filter(i -> "REVIEWED".equals(i.getStatus())).count();
        long dismissed = incidents.stream().filter(i -> "DISMISSED".equals(i.getStatus())).count();

        long lowSeverity = incidents.stream().filter(i -> "LOW".equals(i.getSeverity())).count();
        long mediumSeverity = incidents.stream().filter(i -> "MEDIUM".equals(i.getSeverity())).count();
        long highSeverity = incidents.stream().filter(i -> "HIGH".equals(i.getSeverity())).count();

        return IncidentDto.SummaryResponse.builder()
            .totalIncidents(total)
            .pendingIncidents(pending)
            .reviewedIncidents(reviewed)
            .dismissedIncidents(dismissed)
            .lowSeverityCount(lowSeverity)
            .mediumSeverityCount(mediumSeverity)
            .highSeverityCount(highSeverity)
            .build();
    }
}

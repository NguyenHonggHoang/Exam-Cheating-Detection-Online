package com.example.exam.service;

import com.example.exam.dto.ClientEventRequest;
import com.example.exam.dto.IncidentDto;
import com.example.exam.model.Incident;
import com.example.exam.model.SessionShadowEntity;
import com.example.exam.repository.IncidentRepository;
import com.example.exam.repository.SessionShadowRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Client Event Service
 *
 * Processes violation events from frontend AI detection.
 * Writes are routed through {@link IncidentBatchWriteService} to absorb
 * high-frequency bursts from thousands of concurrent exam sessions without
 * overwhelming the primary datasource.
 */
@Service
@RequiredArgsConstructor
public class ClientEventService {

    private static final Logger log = LoggerFactory.getLogger(ClientEventService.class);

    private final IncidentBatchWriteService incidentBatchWriteService;
    private final SessionShadowRepository sessionShadowRepository;
    private final SseEmitterService sseEmitterService;
    private final IncidentRepository incidentRepository;

    private final java.util.Map<UUID, java.util.Optional<SessionShadowEntity>> sessionCache = new java.util.concurrent.ConcurrentHashMap<>();

    /**
     * Retrieve session shadow entity.
     * Caches the result to prevent read-replica connection pool exhaustion during event floods.
     * REMOVED @Transactional to ensure cache hits don't acquire DB connections!
     */
    public SessionShadowEntity getSessionShadow(UUID sessionId) {
        return sessionCache.computeIfAbsent(sessionId, id -> 
            sessionShadowRepository.findById(id)
        ).orElse(null);
    }

    /**
     * Process client-side detection event
     * 
     * Creates incident record with evidence URL
     * Validates session is active before accepting
     * Optionally triggers AI worker for server-side verification
     * 
     * @param request Client event from frontend
     */
    public void processClientEvent(ClientEventRequest request) {
        log.debug("Processing client event: sessionId={}, violation={}", 
            request.getSessionId(), request.getViolationType());

        try {
            SessionShadowEntity session = getSessionShadow(request.getSessionId());
            
            if (session != null) {
                if (session.getDeleted()) {
                    throw new IllegalStateException("Session has been deleted: " + request.getSessionId());
                }
                
                if (!"ACTIVE".equals(session.getStatus())) {
                    log.warn("Rejecting incident for non-active session: {} (status: {})", 
                        request.getSessionId(), session.getStatus());
                    throw new IllegalStateException(
                        "Session is not active: " + session.getStatus()
                    );
                }
                
                log.debug("Session validation passed: sessionId={}, examId={}, status={}", 
                    session.getSessionId(), session.getExamId(), session.getStatus());
            } else {
                log.warn("Session not found in shadow table (CDC delay?): {}. Processing anyway.", 
                    request.getSessionId());
            }
            
            Incident incident = new Incident();
            incident.setId(UUID.randomUUID());
            incident.setSessionId(request.getSessionId());
            
            incident.setType(mapViolationTypeToIncidentType(request.getViolationType()));
            
            incident.setEvidenceUrl(request.getEvidenceUrl());
            incident.setObjectKey(request.getObjectKey());  
            incident.setFileSize(request.getFileSize());
            
            log.info("📸 Evidence Details - URL: {}, ObjectKey: {}, FileSize: {}", 
                request.getEvidenceUrl() != null ? request.getEvidenceUrl().substring(0, Math.min(80, request.getEvidenceUrl().length())) + "..." : "null",
                request.getObjectKey(),
                request.getFileSize());
            
            if (request.getEvidenceUrl() != null && request.getObjectKey() != null) {
                log.info("✅ Both evidenceUrl and objectKey present - video/snapshot will display correctly");
            } else if (request.getEvidenceUrl() != null) {
                log.warn("⚠️ evidenceUrl present but objectKey missing - may affect video detection");
            } else {
                log.warn("⚠️ No evidence attached to this incident");
            }
            
            incident.setSeverity(mapViolationStateToSeverity(request.getViolationState()));
            
            incident.setStatus("PENDING"); 
            
            incident.setDetectedBy("FRONTEND_AI");
            
            Instant detectedAt = request.getTimestamp() != null 
                ? Instant.ofEpochMilli(request.getTimestamp())
                : Instant.now();
            incident.setDetectedAt(detectedAt);
            incident.setCreatedAt(Instant.now());
            
            incidentBatchWriteService.enqueue(incident);

            log.info("🎯 Incident enqueued for batch write: id={}, type={}, severity={}, hasEvidence={}",
                incident.getId(),
                incident.getType(),
                incident.getSeverity(),
                incident.getEvidenceUrl() != null);
            
            try {
                IncidentDto.Response response = IncidentDto.Response.from(incident);
                if (session != null) {
                    response.setExamId(session.getExamId().toString());
                }
                sseEmitterService.broadcastIncident(response);
                log.debug("Incident broadcast to SSE subscribers: {}", incident.getId());
            } catch (Exception sseError) {
                log.warn("Failed to broadcast incident via SSE (non-fatal): {}", sseError.getMessage());
            }
            
        } catch (Exception e) {
            log.error("Failed to process client event: sessionId={}", request.getSessionId(), e);
            throw new RuntimeException("Failed to create incident from client event", e);
        }
    }

    /**
     * Process a batch of client events, perform session checks, map fields,
     * and persist to database using batch saveAll inside a single transaction.
     * 
     * @param requests list of client events consumed from Kafka
     */
    @Transactional
    public void processClientEventsBatch(List<ClientEventRequest> requests) {
        log.info("Processing batch of {} client events", requests.size());
        List<Incident> incidents = new ArrayList<>();
        
        for (ClientEventRequest request : requests) {
            try {
                SessionShadowEntity session = getSessionShadow(request.getSessionId());
                if (session != null) {
                    if (session.getDeleted()) {
                        continue; // skip deleted sessions
                    }
                    if (!"ACTIVE".equals(session.getStatus())) {
                        continue; // skip inactive sessions
                    }
                }
                
                Incident incident = new Incident();
                incident.setId(UUID.randomUUID());
                incident.setSessionId(request.getSessionId());
                incident.setType(mapViolationTypeToIncidentType(request.getViolationType()));
                incident.setEvidenceUrl(request.getEvidenceUrl());
                incident.setObjectKey(request.getObjectKey());  
                incident.setFileSize(request.getFileSize());
                incident.setSeverity(mapViolationStateToSeverity(request.getViolationState()));
                incident.setStatus("PENDING"); 
                incident.setDetectedBy("FRONTEND_AI");
                
                Instant detectedAt = request.getTimestamp() != null 
                    ? Instant.ofEpochMilli(request.getTimestamp())
                    : Instant.now();
                incident.setDetectedAt(detectedAt);
                incident.setCreatedAt(Instant.now());
                
                incidents.add(incident);
            } catch (Exception e) {
                log.error("Failed to process single client event in batch: sessionId={}", request.getSessionId(), e);
            }
        }
        
        if (!incidents.isEmpty()) {
            List<Incident> saved = incidentRepository.saveAll(incidents);
            log.info("Batch saved {} incidents from Kafka to database", saved.size());
            
            // Broadcast via SSE asynchronously
            for (Incident incident : saved) {
                try {
                    IncidentDto.Response response = IncidentDto.Response.from(incident);
                    SessionShadowEntity session = getSessionShadow(incident.getSessionId());
                    if (session != null) {
                        response.setExamId(session.getExamId().toString());
                    }
                    sseEmitterService.broadcastIncident(response);
                } catch (Exception sseError) {
                    log.warn("Failed to broadcast incident via SSE: {}", sseError.getMessage());
                }
            }
        }
    }

    /**
     * Map frontend violation type to incident type
     */
    private String mapViolationTypeToIncidentType(String violationType) {
        if (violationType == null) return "UNKNOWN";
        
        return switch (violationType) {
            case "MULTIPLE_FACES" -> "MULTIPLE_FACES";
            case "NO_FACE" -> "NO_FACE";
            case "LOOKING_AWAY" -> "LOOKING_AWAY";
            case "EYES_CLOSED" -> "SUSPICIOUS_BEHAVIOR";
            case "TAB_SWITCH" -> "TAB_SWITCH";
            case "PASTE", "PASTE_DETECTED" -> "PASTE";
            case "BLUR", "BLUR_EVENT", "WINDOW_BLUR" -> "BLUR";
            case "FOCUS", "FOCUS_EVENT" -> "FOCUS";
            case "PHONE_DETECTED" -> "PHONE_DETECTED";
            case "BROWSER_EXTENSION" -> "BROWSER_EXTENSION";
            case "BEHAVIOR_ANALYSIS", "TEMPORAL_ANOMALY" -> "BEHAVIOR_ANALYSIS";
            // Composite patterns - HIGH PRIORITY
            case "TAB_PASTE" -> "COMPOSITE_TAB_PASTE";
            case "BLUR_PASTE" -> "COMPOSITE_BLUR_PASTE";
            case "LOOKUP_PATTERN" -> "COMPOSITE_LOOKUP";
            case "MULTI_EVENT_BURST" -> "COMPOSITE_BURST";
            case "SPLIT_SCREEN" -> "COMPOSITE_SPLIT_SCREEN";
            case "SCREEN_CAPTURE" -> "SCREENSHOT_ATTEMPT";
            case "COMPOSITE_PATTERN" -> "COMPOSITE_VIOLATION";
            default -> violationType; // Pass through unknown types as-is
        };
    }

    /**
     * Map violation state to severity
     */
    private String mapViolationStateToSeverity(String violationState) {
        if (violationState == null) return "MEDIUM";
        
        return switch (violationState) {
            case "WARN" -> "LOW";
            case "SUSPICIOUS", "MEDIUM" -> "MEDIUM";
            case "ESCALATED", "HIGH", "CRITICAL" -> "HIGH";
            default -> "MEDIUM";
        };
    }

    private boolean shouldTriggerWorker(Incident incident) {
        return incident.getSeverity().equals("HIGH") 
            || incident.getType().equals("MULTIPLE_FACES");
    }
}

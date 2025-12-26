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
import java.util.UUID;

/**
 * Client Event Service
 * 
 * Processes violation events from frontend AI detection
 */
@Service
@RequiredArgsConstructor
public class ClientEventService {

    private static final Logger log = LoggerFactory.getLogger(ClientEventService.class);

    private final IncidentRepository incidentRepository;
    private final SessionShadowRepository sessionShadowRepository;
    private final SseEmitterService sseEmitterService;
    // TODO: Inject RabbitTemplate for AI worker jobs (optional)

    /**
     * Process client-side detection event
     * 
     * Creates incident record with evidence URL
     * Validates session is active before accepting
     * Optionally triggers AI worker for server-side verification
     * 
     * @param request Client event from frontend
     */
    @Transactional
    public void processClientEvent(ClientEventRequest request) {
        log.debug("Processing client event: sessionId={}, violation={}", 
            request.getSessionId(), request.getViolationType());

        try {
            // STEP 1: Validate session exists and is ACTIVE
            // In dev mode, allow events even if session not found in shadow table
            // (CDC sync may be delayed)
            SessionShadowEntity session = sessionShadowRepository.findById(request.getSessionId())
                .orElse(null);
            
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
                // Session not found in shadow table - CDC might be delayed
                // Log warning but continue processing in dev mode
                log.warn("Session not found in shadow table (CDC delay?): {}. Processing anyway.", 
                    request.getSessionId());
            }
            
            // STEP 2: Create incident from client event
            Incident incident = new Incident();
            incident.setId(UUID.randomUUID());
            incident.setSessionId(request.getSessionId());
            
            // Map violation type to incident type
            incident.setType(mapViolationTypeToIncidentType(request.getViolationType()));
            
            // Set evidence URL and objectKey - BOTH are needed!
            incident.setEvidenceUrl(request.getEvidenceUrl());
            incident.setObjectKey(request.getObjectKey());  // Critical for evidence display!
            incident.setFileSize(request.getFileSize());
            
            // Enhanced logging for evidence tracking
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
            
            // Set severity based on violation state
            incident.setSeverity(mapViolationStateToSeverity(request.getViolationState()));
            
            // Set status
            incident.setStatus("PENDING");  // Will be reviewed by proctor or AI worker
            
            // Set detection source
            incident.setDetectedBy("FRONTEND_AI");
            
            // Set timestamps
            Instant detectedAt = request.getTimestamp() != null 
                ? Instant.ofEpochMilli(request.getTimestamp())
                : Instant.now();
            incident.setDetectedAt(detectedAt);
            incident.setCreatedAt(Instant.now());
            
            // Save additional metadata as JSON or separate fields (depends on schema)
            // incident.setMetadata(buildMetadata(request));
            
            // Save incident
            Incident savedIncident = incidentRepository.save(incident);
            
            log.info("🎯 Incident created from client event: id={}, type={}, severity={}, hasEvidence={}", 
                incident.getId(), 
                incident.getType(), 
                incident.getSeverity(),
                incident.getEvidenceUrl() != null);
            
            // Broadcast to connected proctors via SSE
            try {
                IncidentDto.Response response = IncidentDto.Response.from(savedIncident);
                // Try to get examId from session shadow
                if (session != null) {
                    response.setExamId(session.getExamId().toString());
                }
                sseEmitterService.broadcastIncident(response);
                log.debug("Incident broadcast to SSE subscribers: {}", savedIncident.getId());
            } catch (Exception sseError) {
                log.warn("Failed to broadcast incident via SSE (non-fatal): {}", sseError.getMessage());
            }
            
            // Optional: Trigger AI worker for server-side verification
            // if (shouldTriggerWorker(incident)) {
            //     rabbitTemplate.convertAndSend("ai.jobs", new AnalysisJob(incident.getId(), incident.getEvidenceUrl()));
            // }
            
        } catch (Exception e) {
            log.error("Failed to process client event: sessionId={}", request.getSessionId(), e);
            throw new RuntimeException("Failed to create incident from client event", e);
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

    /**
     * Determine if AI worker should be triggered
     * 
     * Criteria:
     * - HIGH severity
     * - MULTIPLE_FACES type (needs face recognition)
     * - Large file size (video clip vs snapshot)
     */
    private boolean shouldTriggerWorker(Incident incident) {
        return incident.getSeverity().equals("HIGH") 
            || incident.getType().equals("MULTIPLE_FACES");
    }
}

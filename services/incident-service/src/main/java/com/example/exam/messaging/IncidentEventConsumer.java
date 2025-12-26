package com.example.exam.messaging;

import com.example.exam.model.Incident;
import com.example.exam.repository.IncidentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * RabbitMQ Consumer for Incident Events from Session Service
 * 
 * Session service sends incident events here when:
 * - Face detection worker detects NO_FACE or MULTIPLE_FACES
 * - Rule engine detects TAB_SWITCH or PASTE violations
 */
@Service
public class IncidentEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(IncidentEventConsumer.class);
    private final IncidentRepository incidentRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public IncidentEventConsumer(IncidentRepository incidentRepository) {
        this.incidentRepository = incidentRepository;
    }

    /**
     * Consume incident events from session-service
     * Queue: incident.create
     * 
     * Message Format (from session-service IncidentEventDto):
     * {
     *   "sessionId": "uuid",
     *   "type": "NO_FACE",
     *   "timestamp": 1701543600000,
     *   "score": 0.70,
     *   "reason": "No face detected in webcam snapshot",
     *   "evidenceUrl": "exam-evidence/...",
     *   "detectedBy": "SERVER_AI",
     *   "eventTime": "2024-12-12T10:00:00Z"
     * }
     */
    @RabbitListener(queues = "incident.create")
    public void handleIncidentEvent(String message) {
        try {
            log.info("[RabbitMQ] Received incident event: {}", message);
            
            JsonNode event = objectMapper.readTree(message);
            
            String sessionIdStr = event.get("sessionId").asText();
            UUID sessionId = UUID.fromString(sessionIdStr);
            String type = event.get("type").asText();
            long timestamp = event.get("timestamp").asLong();
            double score = event.has("score") ? event.get("score").asDouble() : 0.5;
            String reason = event.has("reason") ? event.get("reason").asText() : null;
            String evidenceUrl = event.has("evidenceUrl") ? event.get("evidenceUrl").asText() : null;
            String detectedBy = event.has("detectedBy") ? event.get("detectedBy").asText() : "SERVER_AI";
            
            // Check for duplicate (idempotency)
            Optional<Incident> existing = incidentRepository.findBySessionIdAndTypeAndDetectedAt(
                    sessionId, type, Instant.ofEpochMilli(timestamp)
            );
            
            if (existing.isPresent()) {
                log.debug("[RabbitMQ] Duplicate incident event ignored: sessionId={}, type={}", sessionId, type);
                return;
            }
            
            // Create incident
            Incident incident = new Incident();
            incident.setId(UUID.randomUUID());
            incident.setSessionId(sessionId);
            incident.setType(type);
            incident.setSeverity(mapScoreToSeverity(score));
            incident.setStatus("PENDING");
            incident.setEvidenceUrl(evidenceUrl);
            incident.setObjectKey(evidenceUrl); // EVIDENCE URL from session-service IS the object key
            incident.setDetectedBy(detectedBy);
            incident.setDetectedAt(Instant.ofEpochMilli(timestamp));
            incident.setCreatedAt(Instant.now());
            
            Incident saved = incidentRepository.save(incident);
            log.info("[RabbitMQ] Created incident from event: id={}, type={}, sessionId={}", 
                    saved.getId(), type, sessionId);
            
            // TODO: Send real-time alert to proctor dashboard via WebSocket
            
        } catch (Exception e) {
            log.error("[RabbitMQ] Error processing incident event: {}", message, e);
        }
    }
    
    /**
     * Map score to severity level
     */
    private String mapScoreToSeverity(double score) {
        if (score >= 0.85) {
            return "HIGH";
        } else if (score >= 0.60) {
            return "MEDIUM";
        } else {
            return "LOW";
        }
    }
}

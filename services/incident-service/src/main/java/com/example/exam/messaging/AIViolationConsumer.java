package com.example.exam.messaging;

import com.example.exam.model.Incident;
import com.example.exam.repository.IncidentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

/**
 * RabbitMQ Consumer for AI Worker Violations
 * 
 * Python AI Workers send lightweight violation events here for fast processing
 */
@Service
public class AIViolationConsumer {

    private static final Logger log = LoggerFactory.getLogger(AIViolationConsumer.class);
    private final IncidentRepository incidentRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AIViolationConsumer(IncidentRepository incidentRepository) {
        this.incidentRepository = incidentRepository;
    }

    /**
     * Consume violation events from Python AI workers
     * Queue: ai.violations
     * 
     * Message Format (from Python):
     * {
     *   "session_id": "uuid",
     *   "timestamp": 1701543600000,
     *   "violation_type": "PHONE_DETECTED",
     *   "confidence": 0.95,
     *   "evidence_url": "http://minio:9000/exam-evidence/..."
     * }
     */
    @RabbitListener(queues = "ai.violations")
    public void handleAIViolation(String message) {
        try {
            log.info("[RabbitMQ] Received AI violation: {}", message);
            
            JsonNode event = objectMapper.readTree(message);
            
            String sessionId = event.get("session_id").asText();
            long timestamp = event.get("timestamp").asLong();
            String violationType = event.get("violation_type").asText();
            double confidence = event.get("confidence").asDouble();
            String evidenceUrl = event.has("evidence_url") ? event.get("evidence_url").asText() : null;
            
            // Create incident
            Incident incident = new Incident();
            incident.setId(UUID.randomUUID());
            incident.setSessionId(UUID.fromString(sessionId));
            incident.setEvidenceUrl(evidenceUrl);
            incident.setObjectKey(evidenceUrl); // Assuming Python sends key or we treat URL as key for legacy support
            incident.setType(violationType);
            incident.setSeverity(confidence >= 0.9 ? "HIGH" : confidence >= 0.7 ? "MEDIUM" : "LOW");
            incident.setStatus("PENDING");
            incident.setEvidenceUrl(evidenceUrl);
            incident.setDetectedBy("SERVER_AI");
            incident.setDetectedAt(Instant.ofEpochMilli(timestamp));
            incident.setCreatedAt(Instant.now());
            
            Incident saved = incidentRepository.save(incident);
            log.info("[RabbitMQ] Created incident: id={}, type={}", saved.getId(), violationType);
            
            // TODO: Send real-time alert to proctor dashboard via WebSocket
            
        } catch (Exception e) {
            log.error("[RabbitMQ] Error processing AI violation", e);
        }
    }
}

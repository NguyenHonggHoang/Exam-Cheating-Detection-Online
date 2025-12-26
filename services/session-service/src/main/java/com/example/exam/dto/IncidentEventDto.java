package com.example.exam.dto;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * DTO for incident events sent to incident-service via RabbitMQ
 * 
 * Flow: session-service → RabbitMQ → incident-service
 * 
 * This allows session-service to remain decoupled from incident-service
 * and follow microservices principles.
 */
public record IncidentEventDto(
    UUID sessionId,
    String type,           // MULTIPLE_FACES, NO_FACE, TAB_ABUSE, PASTE, etc.
    Long timestamp,        // Epoch milliseconds
    BigDecimal score,      // 0.0 - 1.0 confidence/severity
    String reason,         // Human-readable description
    String evidenceUrl,    // Optional: MinIO URL to evidence
    String detectedBy,     // FRONTEND_AI, SERVER_AI, RULE_ENGINE
    Instant eventTime      // When the event was created
) implements Serializable {
    
    public IncidentEventDto {
        if (sessionId == null) {
            throw new IllegalArgumentException("sessionId cannot be null");
        }
        if (type == null || type.isBlank()) {
            throw new IllegalArgumentException("type cannot be null or blank");
        }
        if (timestamp == null) {
            timestamp = System.currentTimeMillis();
        }
        if (score == null) {
            score = BigDecimal.ZERO;
        }
        if (eventTime == null) {
            eventTime = Instant.now();
        }
        if (detectedBy == null) {
            detectedBy = "SERVER_AI";
        }
    }
    
    /**
     * Builder pattern for easier construction
     */
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private UUID sessionId;
        private String type;
        private Long timestamp;
        private BigDecimal score = BigDecimal.ZERO;
        private String reason;
        private String evidenceUrl;
        private String detectedBy = "SERVER_AI";
        private Instant eventTime = Instant.now();
        
        public Builder sessionId(UUID sessionId) {
            this.sessionId = sessionId;
            return this;
        }
        
        public Builder type(String type) {
            this.type = type;
            return this;
        }
        
        public Builder timestamp(Long timestamp) {
            this.timestamp = timestamp;
            return this;
        }
        
        public Builder score(BigDecimal score) {
            this.score = score;
            return this;
        }
        
        public Builder reason(String reason) {
            this.reason = reason;
            return this;
        }
        
        public Builder evidenceUrl(String evidenceUrl) {
            this.evidenceUrl = evidenceUrl;
            return this;
        }
        
        public Builder detectedBy(String detectedBy) {
            this.detectedBy = detectedBy;
            return this;
        }
        
        public Builder eventTime(Instant eventTime) {
            this.eventTime = eventTime;
            return this;
        }
        
        public IncidentEventDto build() {
            return new IncidentEventDto(sessionId, type, timestamp, score, reason, evidenceUrl, detectedBy, eventTime);
        }
    }
}

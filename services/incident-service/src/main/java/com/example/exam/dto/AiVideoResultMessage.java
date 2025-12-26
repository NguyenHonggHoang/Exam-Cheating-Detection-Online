package com.example.exam.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * DTO for AI Video Analysis Result from UnifiedVideoWorker
 * 
 * Consumed from queue: ai.result.video
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AiVideoResultMessage {
    
    private String sessionId;
    private String videoUrl;
    private boolean isViolation;
    private float confidence;
    private Map<String, Object> detections;
    private List<String> reasons;
    private String initialViolationType;
    private long timestamp;
    private int processingTimeMs;
    
    /**
     * Get sessionId as UUID
     */
    public UUID getSessionIdAsUUID() {
        try {
            return UUID.fromString(sessionId);
        } catch (Exception e) {
            return null;
        }
    }
    
    /**
     * Check if screen glow was detected
     */
    public boolean hasScreenGlow() {
        if (detections == null) return false;
        Object screenGlow = detections.get("screenGlow");
        if (screenGlow instanceof Map) {
            Object detected = ((Map<?, ?>) screenGlow).get("detected");
            return Boolean.TRUE.equals(detected);
        }
        return false;
    }
    
    /**
     * Check if document was detected
     */
    public boolean hasDocument() {
        if (detections == null) return false;
        Object document = detections.get("document");
        if (document instanceof Map) {
            Object detected = ((Map<?, ?>) document).get("detected");
            return Boolean.TRUE.equals(detected);
        }
        return false;
    }
    
    /**
     * Check if hand motion was detected
     */
    public boolean hasHandMotion() {
        if (detections == null) return false;
        Object handMotion = detections.get("handMotion");
        if (handMotion instanceof Map) {
            Object detected = ((Map<?, ?>) handMotion).get("detected");
            return Boolean.TRUE.equals(detected);
        }
        return false;
    }
    
    /**
     * Check if objects were detected
     */
    public boolean hasObjects() {
        if (detections == null) return false;
        Object objects = detections.get("objects");
        if (objects instanceof Map) {
            Object detected = ((Map<?, ?>) objects).get("detected");
            return Boolean.TRUE.equals(detected);
        }
        return false;
    }
}

package com.example.exam.listener;

import com.example.exam.config.RabbitMQConfig;
import com.example.exam.dto.AiVideoResultMessage;
import com.example.exam.model.Incident;
import com.example.exam.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * Listener for AI Video Analysis Results from UnifiedVideoWorker
 * 
 * Flow:
 * 1. UnifiedVideoWorker processes video with ComprehensiveAnalyzer
 * 2. Publishes result to ai.result.video queue
 * 3. This listener receives the result
 * 4. If is_violation=true, creates incident with AI-determined severity
 * 5. If is_violation=false, logs as false positive (no incident)
 */
@Component
@RequiredArgsConstructor
public class AiVideoResultListener {
    
    private static final Logger log = LoggerFactory.getLogger(AiVideoResultListener.class);
    
    private final IncidentRepository incidentRepository;
    
    @RabbitListener(queues = RabbitMQConfig.AI_VIDEO_RESULT_QUEUE)
    public void handleAiVideoResult(AiVideoResultMessage message) {
        log.info("[AiVideoResult] Received AI analysis result: sessionId={}, isViolation={}, confidence={}",
                message.getSessionId(), message.isViolation(), message.getConfidence());
        
        try {
            if (message.isViolation()) {
                // Create incident from AI confirmation
                createIncidentFromAiResult(message);
            } else {
                // Log as false positive
                log.info("[AiVideoResult] AI rejected as false positive: sessionId={}, reasons={}",
                        message.getSessionId(), message.getReasons());
            }
        } catch (Exception e) {
            log.error("[AiVideoResult] Failed to process AI result: {}", e.getMessage(), e);
        }
    }
    
    private void createIncidentFromAiResult(AiVideoResultMessage message) {
        UUID sessionId = message.getSessionIdAsUUID();
        if (sessionId == null) {
            log.error("[AiVideoResult] Invalid sessionId: {}", message.getSessionId());
            return;
        }
        
        // Create incident
        Incident incident = new Incident();
        incident.setId(UUID.randomUUID());
        incident.setSessionId(sessionId);
        
        // Determine incident type from detections
        String incidentType = determineIncidentType(message);
        incident.setType(incidentType);
        
        // Set severity based on confidence
        String severity = determineSeverity(message.getConfidence());
        incident.setSeverity(severity);
        
        // Set evidence URL
        incident.setEvidenceUrl(message.getVideoUrl());
        
        // Set status
        incident.setStatus("PENDING");
        
        // Set detected by
        incident.setDetectedBy("UNIFIED_AI_WORKER");
        
        // Set timestamps
        Instant detectedAt = message.getTimestamp() > 0 
            ? Instant.ofEpochMilli(message.getTimestamp()) 
            : Instant.now();
        incident.setDetectedAt(detectedAt);
        incident.setCreatedAt(Instant.now());
        
        // Save incident
        incidentRepository.save(incident);
        
        log.info("[AiVideoResult] ✅ Created incident from AI analysis: id={}, type={}, severity={}, confidence={}",
                incident.getId(), incidentType, severity, message.getConfidence());
        
        // Note: SSE notification is handled by IncidentEventConsumer or other mechanisms
    }
    
    /**
     * Determine incident type from AI detections
     */
    private String determineIncidentType(AiVideoResultMessage message) {
        // Priority order: Phone > Document > Hand Motion > Screen Glow
        if (message.hasObjects()) {
            return "PHONE_USAGE";
        }
        if (message.hasDocument()) {
            return "DOCUMENT_DETECTED";
        }
        if (message.hasHandMotion()) {
            return "SUSPICIOUS_HAND_MOTION";
        }
        if (message.hasScreenGlow()) {
            return "SCREEN_GLOW";
        }
        
        // Fallback to initial violation type
        String initialType = message.getInitialViolationType();
        if (initialType != null && !initialType.isEmpty() && !"UNKNOWN".equals(initialType)) {
            return initialType;
        }
        
        return "AI_DETECTED_VIOLATION";
    }
    
    /**
     * Determine severity from confidence score
     */
    private String determineSeverity(float confidence) {
        if (confidence >= 85) {
            return "HIGH";
        } else if (confidence >= 70) {
            return "MEDIUM";
        } else {
            return "LOW";
        }
    }
}

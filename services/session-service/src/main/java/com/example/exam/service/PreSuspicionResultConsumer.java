package com.example.exam.service;

import com.example.exam.config.RabbitMQConfig;
import com.example.exam.model.Session;
import com.example.exam.repository.SessionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Pre-Suspicion Result Consumer
 * 
 * Listens to pre-suspicion analysis results from Python AI Worker.
 * Forwards violations to candidates via WebSocket.
 * Creates incidents for proctor review.
 */
@Service
public class PreSuspicionResultConsumer {
    
    private static final Logger log = LoggerFactory.getLogger(PreSuspicionResultConsumer.class);
    
    private final WebSocketNotificationService wsService;
    private final SessionRepository sessionRepository;
    private final ObjectMapper objectMapper;
    
    // Score thresholds for severity
    private static final double HIGH_SEVERITY_THRESHOLD = 80.0;
    private static final double MEDIUM_SEVERITY_THRESHOLD = 60.0;
    
    public PreSuspicionResultConsumer(
            WebSocketNotificationService wsService,
            SessionRepository sessionRepository,
            ObjectMapper objectMapper) {
        this.wsService = wsService;
        this.sessionRepository = sessionRepository;
        this.objectMapper = objectMapper;
    }
    
    /**
     * Process pre-suspicion analysis result from Python AI Worker
     */
    @RabbitListener(queues = RabbitMQConfig.PRE_SUSPICION_RESULT_QUEUE)
    public void handlePreSuspicionResult(String message) {
        try {
            log.info("[PreSuspicionConsumer] Received message: {}", message);
            
            JsonNode root = objectMapper.readTree(message);
            
            String sessionId = root.path("sessionId").asText();
            JsonNode resultNode = root.path("result");
            
            if (sessionId == null || sessionId.isEmpty()) {
                log.warn("[PreSuspicionConsumer] Missing sessionId in message");
                return;
            }
            
            // Extract analysis result
            boolean isPhoneDetected = resultNode.path("is_phone_detected").asBoolean(false);
            double maxScore = resultNode.path("max_score").asDouble(0);
            double suspicionRatio = resultNode.path("suspicion_ratio").asDouble(0);
            String suspicionType = resultNode.path("suspicionType").asText("unknown");
            
            // Extract reasons
            List<String> reasons = new ArrayList<>();
            JsonNode reasonsNode = resultNode.path("reasons");
            if (reasonsNode.isArray()) {
                for (JsonNode reason : reasonsNode) {
                    reasons.add(reason.asText());
                }
            }
            
            log.info("[PreSuspicionConsumer] Session {}: phone_detected={}, score={}, reasons={}",
                    sessionId, isPhoneDetected, maxScore, reasons);
            
            // Determine severity based on score
            String severity = determineSeverity(maxScore, isPhoneDetected);
            
            // Only notify if there's something significant
            if (isPhoneDetected || maxScore >= MEDIUM_SEVERITY_THRESHOLD) {
                // Notify candidate of violation
                String violationType = "PHONE_DETECTED";
                wsService.notifyAIViolation(sessionId, violationType, severity, maxScore, reasons);
                
                // Get exam ID for proctor notification
                Optional<Session> sessionOpt = sessionRepository.findById(UUID.fromString(sessionId));
                if (sessionOpt.isPresent()) {
                    Session session = sessionOpt.get();
                    String examId = session.getExamId().toString();
                    
                    // Notify proctor dashboard
                    wsService.notifyAIAnalysisResult(
                            examId,
                            sessionId,
                            violationType,
                            isPhoneDetected,
                            maxScore,
                            reasons
                    );
                    
                    log.info("[PreSuspicionConsumer] Sent notifications for session {} (exam {})", 
                            sessionId, examId);
                } else {
                    log.warn("[PreSuspicionConsumer] Session not found: {}", sessionId);
                }
            } else {
                log.debug("[PreSuspicionConsumer] Score {} below threshold, no notification", maxScore);
            }
            
        } catch (Exception e) {
            log.error("[PreSuspicionConsumer] Failed to process message: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Determine severity based on score
     */
    private String determineSeverity(double score, boolean isPhoneDetected) {
        if (isPhoneDetected || score >= HIGH_SEVERITY_THRESHOLD) {
            return "HIGH";
        } else if (score >= MEDIUM_SEVERITY_THRESHOLD) {
            return "MEDIUM";
        } else {
            return "LOW";
        }
    }
}

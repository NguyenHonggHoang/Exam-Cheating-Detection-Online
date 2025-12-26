package com.example.exam.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * WebSocket Notification Service
 * 
 * Sends realtime notifications to connected clients via STOMP.
 * 
 * Topics:
 * - /topic/proctor/escalations - New escalation notifications
 * - /topic/proctor/{examId}/incidents - New incidents for exam
 * - /topic/session/{sessionId}/status - Session status changes
 * - /user/queue/verification - User-specific verification results
 */
@Service
public class WebSocketNotificationService {
    
    private static final Logger log = LoggerFactory.getLogger(WebSocketNotificationService.class);
    
    private final SimpMessagingTemplate messagingTemplate;
    
    public WebSocketNotificationService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }
    
    /**
     * Notify proctors of new escalation request
     */
    public void notifyNewEscalation(UUID escalationId, UUID sessionId, String userId, String reason) {
        log.info("[WS] Sending escalation notification: {}", escalationId);
        
        messagingTemplate.convertAndSend("/topic/proctor/escalations", Map.of(
                "type", "NEW_ESCALATION",
                "escalationId", escalationId.toString(),
                "sessionId", sessionId.toString(),
                "userId", userId,
                "reason", reason,
                "timestamp", Instant.now().toString()
        ));
    }
    
    /**
     * Notify of escalation decision (for student polling replacement)
     */
    public void notifyEscalationDecision(UUID sessionId, String userId, String status, String proctorNote) {
        log.info("[WS] Sending escalation decision: {} -> {}", sessionId, status);
        
        // Broadcast to session topic
        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/verification", Map.of(
                "type", "ESCALATION_DECISION",
                "sessionId", sessionId.toString(),
                "status", status,
                "proctorNote", proctorNote != null ? proctorNote : "",
                "timestamp", Instant.now().toString()
        ));
    }
    
    /**
     * Notify of new incident for exam
     */
    public void notifyNewIncident(String examId, UUID sessionId, String incidentType, String severity) {
        log.info("[WS] Sending incident notification for exam {}: {}", examId, incidentType);
        
        messagingTemplate.convertAndSend("/topic/proctor/" + examId + "/incidents", Map.of(
                "type", "NEW_INCIDENT",
                "examId", examId,
                "sessionId", sessionId.toString(),
                "incidentType", incidentType,
                "severity", severity,
                "timestamp", Instant.now().toString()
        ));
    }
    
    /**
     * Notify of session status change
     */
    public void notifySessionStatus(UUID sessionId, String status) {
        log.info("[WS] Sending session status: {} -> {}", sessionId, status);
        
        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/status", Map.of(
                "type", "SESSION_STATUS",
                "sessionId", sessionId.toString(),
                "status", status,
                "timestamp", Instant.now().toString()
        ));
    }
    
    /**
     * Notify user of verification result (direct to user)
     */
    public void notifyVerificationResult(String userId, UUID sessionId, boolean verified, String message) {
        log.info("[WS] Sending verification result to user {}: verified={}", userId, verified);
        
        // Send to user-specific queue
        messagingTemplate.convertAndSendToUser(userId, "/queue/verification", Map.of(
                "type", "VERIFICATION_RESULT",
                "sessionId", sessionId.toString(),
                "verified", verified,
                "message", message,
                "timestamp", Instant.now().toString()
        ));
    }
    
    /**
     * Notify candidate of AI-detected violation (phone detection, etc.)
     * This is sent directly to the candidate's session topic
     */
    public void notifyAIViolation(String sessionId, String violationType, String severity, 
                                   double score, java.util.List<String> reasons) {
        log.info("[WS] Sending AI violation to session {}: {} ({})", sessionId, violationType, severity);
        
        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/ai-violations", Map.of(
                "type", "AI_VIOLATION",
                "sessionId", sessionId,
                "violationType", violationType,
                "severity", severity,
                "score", score,
                "reasons", reasons,
                "timestamp", Instant.now().toString()
        ));
    }
    
    /**
     * Notify proctor of AI analysis result (for incident service / proctor dashboard)
     */
    public void notifyAIAnalysisResult(String examId, String sessionId, String analysisType,
                                        boolean isPositive, double score, java.util.List<String> reasons) {
        log.info("[WS] Sending AI analysis result for exam {}: {} positive={}", examId, analysisType, isPositive);
        
        messagingTemplate.convertAndSend("/topic/exam/" + examId + "/incidents", Map.of(
                "type", "NEW_INCIDENT",
                "incidentId", UUID.randomUUID().toString(),
                "sessionId", sessionId,
                "incidentType", analysisType,
                "severity", isPositive ? "HIGH" : "LOW",
                "score", score,
                "reasons", reasons,
                "detectedAt", Instant.now().toString(),
                "timestamp", Instant.now().toString()
        ));
    }
    
    /**
     * Notify proctor that a new student has joined/started exam session
     * Used by LiveMonitoringPage to receive real-time updates instead of polling
     */
    public void notifySessionStarted(UUID examId, UUID sessionId, String userId, String status) {
        log.info("[WS] Sending session started notification: exam={}, session={}", examId, sessionId);
        
        messagingTemplate.convertAndSend("/topic/exam/" + examId + "/sessions", Map.of(
                "type", "SESSION_STARTED",
                "examId", examId.toString(),
                "sessionId", sessionId.toString(),
                "userId", userId,
                "status", status,
                "timestamp", Instant.now().toString()
        ));
    }
    
    /**
     * Notify proctor that a student session has ended
     */
    public void notifySessionEnded(UUID examId, UUID sessionId, String userId) {
        log.info("[WS] Sending session ended notification: exam={}, session={}", examId, sessionId);
        
        messagingTemplate.convertAndSend("/topic/exam/" + examId + "/sessions", Map.of(
                "type", "SESSION_ENDED",
                "examId", examId.toString(),
                "sessionId", sessionId.toString(),
                "userId", userId,
                "timestamp", Instant.now().toString()
        ));
    }
    
    /**
     * Notify proctor of session status change
     */
    public void notifySessionStatusChange(UUID examId, UUID sessionId, String userId, String oldStatus, String newStatus) {
        log.info("[WS] Sending session status change: {} -> {}", oldStatus, newStatus);
        
        messagingTemplate.convertAndSend("/topic/exam/" + examId + "/sessions", Map.of(
                "type", "SESSION_STATUS_CHANGED",
                "examId", examId.toString(),
                "sessionId", sessionId.toString(),
                "userId", userId,
                "oldStatus", oldStatus,
                "newStatus", newStatus,
                "timestamp", Instant.now().toString()
        ));
    }
}


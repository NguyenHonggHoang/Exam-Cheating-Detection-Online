package com.example.exam.messaging;

import com.example.exam.model.SessionShadowEntity;
import com.example.exam.model.UserShadowEntity;
import com.example.exam.repository.IncidentRepository;
import com.example.exam.repository.SessionShadowRepository;
import com.example.exam.repository.UserShadowRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Data Sync Consumer - Incident Service
 *
 * Consumes CDC events from Debezium (with ExtractNewRecordState transform)
 * and maintains shadow tables for local queries.
 *
 * Topics:
 * - exam-session.public.sessions → SessionShadowEntity
 * - exam-identity.public.users  → UserShadowEntity
 *
 * NOTE: Debezium uses ExtractNewRecordState transform, so events are UNWRAPPED
 * (no payload.before/after, fields are at root level with __op, __deleted fields)
 */
@Component
@RequiredArgsConstructor
public class DataSyncConsumer {

    private static final Logger log = LoggerFactory.getLogger(DataSyncConsumer.class);

    private final SessionShadowRepository sessionShadowRepository;
    private final UserShadowRepository userShadowRepository;
    private final IncidentRepository incidentRepository;
    private final ObjectMapper objectMapper;
    
    // ==================== SESSION CDC ====================
    
    /**
     * Consume session CDC events (UNWRAPPED format)
     * 
     * Topic: exam-session.public.sessions
     * 
     * Unwrapped Debezium event format:
     * {
     *   "id": "uuid",
     *   "user_id": "uuid",
     *   "exam_id": "uuid", 
     *   "status": "ACTIVE",
     *   "__op": "c|u|d|r",
     *   "__deleted": "true|false"
     * }
     */
    @KafkaListener(
        topics = "exam-session.public.sessions",
        groupId = "incident-service-session-sync",
        containerFactory = "kafkaListenerContainerFactory"
    )
    @Transactional
    public void consumeSessionEvent(String message) {
        try {
            log.debug("[CDC Session] Received: {}", truncate(message, 300));
            
            JsonNode event = objectMapper.readTree(message);
            
            // ExtractNewRecordState adds __op field at root level
            String operation = getStringOrDefault(event, "__op", "r");
            boolean isDeleted = getBooleanOrDefault(event, "__deleted", false);
            
            String sessionIdStr = getStringOrNull(event, "id");
            if (sessionIdStr == null) {
                log.warn("[CDC Session] Missing session ID in event");
                return;
            }
            
            log.info("[CDC Session] Processing: sessionId={}, op={}, deleted={}", 
                sessionIdStr, operation, isDeleted);
            
            if (isDeleted || "d".equals(operation)) {
                handleSessionDelete(sessionIdStr);
            } else {
                handleSessionUpsert(event, sessionIdStr);
            }
            
        } catch (Exception e) {
            log.error("[CDC Session] Error processing event: {}", truncate(message, 200), e);
            throw new RuntimeException("Session CDC processing failed", e);
        }
    }
    
    private void handleSessionUpsert(JsonNode event, String sessionIdStr) {
        try {
            UUID sessionId = UUID.fromString(sessionIdStr);
            
            // Extract fields - user_id is String, exam_id is UUID
            String userIdStr = getStringOrNull(event, "user_id");
            String examIdStr = getStringOrNull(event, "exam_id");
            String status = getStringOrDefault(event, "status", "ACTIVE");
            
            // Parse timestamps (Debezium may send as epoch micros or ISO string)
            Instant startedAt = parseTimestamp(event, "started_at");
            Instant endedAt = parseTimestamp(event, "ended_at");
            
            // Upsert to shadow table
            SessionShadowEntity shadow = sessionShadowRepository.findById(sessionId)
                .orElse(new SessionShadowEntity());
            
            shadow.setSessionId(sessionId);
            if (userIdStr != null) {
                shadow.setUserId(userIdStr);  // user_id is String, not UUID
            }
            if (examIdStr != null) {
                shadow.setExamId(UUID.fromString(examIdStr));
            }
            shadow.setStatus(status);
            shadow.setStartedAt(startedAt != null ? startedAt : Instant.now());
            shadow.setEndedAt(endedAt);
            shadow.setDeleted(false);
            shadow.setSyncedAt(Instant.now());
            
            sessionShadowRepository.save(shadow);
            
            log.info("[CDC Session] ✅ Synced: id={}, exam={}, status={}", 
                sessionId, examIdStr, status);

            // Auto-close incidents if session ended
            if (shadow.isEnded()) {
                handleSessionEnded(sessionId);
            }
            
        } catch (Exception e) {
            log.error("[CDC Session] Failed to upsert: {}", sessionIdStr, e);
            throw e;
        }
    }
    
    private void handleSessionDelete(String sessionIdStr) {
        try {
            UUID sessionId = UUID.fromString(sessionIdStr);
            
            sessionShadowRepository.findById(sessionId).ifPresent(shadow -> {
                shadow.setDeleted(true);
                shadow.setSyncedAt(Instant.now());
                sessionShadowRepository.save(shadow);
                log.info("[CDC Session] ✅ Soft-deleted: id={}", sessionId);
            });
            
        } catch (Exception e) {
            log.error("[CDC Session] Failed to delete: {}", sessionIdStr, e);
        }
    }

    /**
     * Auto-close open (PENDING) incidents when the session ends.
     *
     * Uses a single bulk UPDATE instead of load-iterate-save to handle sessions
     * that may have accumulated hundreds of incidents during a long exam.
     *
     * The target status is "SESSION_ENDED" (not "REVIEWED" or "DISMISSED") so that
     * proctors can distinguish auto-closed incidents from human-reviewed ones.
     */
    @Transactional
    protected void handleSessionEnded(UUID sessionId) {
        log.info("[CDC Session] Session ended — bulk-closing PENDING incidents: sessionId={}", sessionId);
        try {
            int updated = incidentRepository.bulkCloseBySessionId(
                    sessionId,
                    "SESSION_ENDED",
                    Instant.now()
            );
            if (updated > 0) {
                log.info("[CDC Session] ✅ Auto-closed {} PENDING incident(s) for session={}", updated, sessionId);
            } else {
                log.debug("[CDC Session] No PENDING incidents to close for session={}", sessionId);
            }
        } catch (Exception e) {
            log.error("[CDC Session] Failed to auto-close incidents for session={}", sessionId, e);
            // Non-fatal: the CDC event is already committed; do not rethrow
            // so Kafka does not redeliver the session-end event indefinitely.
        }
    }
    
    // ==================== USER CDC ====================
    
    /**
     * Consume user CDC events (UNWRAPPED format)
     * 
     * Topic: exam-identity.public.users
     */
    @KafkaListener(
        topics = "exam-identity.public.users",
        groupId = "incident-service-user-sync",
        containerFactory = "kafkaListenerContainerFactory"
    )
    @Transactional
    public void consumeUserEvent(String message) {
        try {
            log.debug("[CDC User] Received: {}", truncate(message, 300));
            
            JsonNode event = objectMapper.readTree(message);
            
            String operation = getStringOrDefault(event, "__op", "r");
            boolean isDeleted = getBooleanOrDefault(event, "__deleted", false);
            
            String userId = getStringOrNull(event, "id");
            if (userId == null) {
                log.warn("[CDC User] Missing user ID in event");
                return;
            }
            
            log.info("[CDC User] Processing: userId={}, op={}, deleted={}", 
                userId, operation, isDeleted);
            
            if (isDeleted || "d".equals(operation)) {
                handleUserDelete(userId);
            } else {
                handleUserUpsert(event, userId);
            }
            
        } catch (Exception e) {
            log.error("[CDC User] Error processing event: {}", truncate(message, 200), e);
            throw new RuntimeException("User CDC processing failed", e);
        }
    }
    
    private void handleUserUpsert(JsonNode event, String userId) {
        try {
            // Extract user fields - be tolerant of missing fields
            String username = getStringOrNull(event, "username");
            String email = getStringOrNull(event, "email");
            String role = getStringOrDefault(event, "role", "CANDIDATE");
            
            // Upsert to shadow table
            UserShadowEntity shadow = userShadowRepository.findById(userId)
                .orElse(new UserShadowEntity());
            
            shadow.setUserId(userId);
            shadow.setFullName(username); // Map username to fullName
            shadow.setEmail(email);
            shadow.setRole(role);
            shadow.setDeleted(false);
            shadow.setSyncedAt(Instant.now());
            
            userShadowRepository.save(shadow);
            
            log.info("[CDC User] ✅ Synced: id={}, username={}, role={}", 
                userId, username, role);
            
        } catch (Exception e) {
            log.error("[CDC User] Failed to upsert: {}", userId, e);
            throw e;
        }
    }
    
    private void handleUserDelete(String userId) {
        try {
            userShadowRepository.findById(userId).ifPresent(shadow -> {
                shadow.setDeleted(true);
                shadow.setSyncedAt(Instant.now());
                userShadowRepository.save(shadow);
                log.info("[CDC User] ✅ Soft-deleted: id={}", userId);
            });
            
        } catch (Exception e) {
            log.error("[CDC User] Failed to delete: {}", userId, e);
        }
    }
    
    // ==================== HELPER METHODS ====================
    
    private String getStringOrNull(JsonNode node, String fieldName) {
        return node.has(fieldName) && !node.get(fieldName).isNull() 
            ? node.get(fieldName).asText() 
            : null;
    }
    
    private String getStringOrDefault(JsonNode node, String fieldName, String defaultValue) {
        return node.has(fieldName) && !node.get(fieldName).isNull() 
            ? node.get(fieldName).asText() 
            : defaultValue;
    }
    
    private Boolean getBooleanOrDefault(JsonNode node, String fieldName, Boolean defaultValue) {
        if (!node.has(fieldName) || node.get(fieldName).isNull()) {
            return defaultValue;
        }
        // Handle both boolean and string "true"/"false"
        JsonNode fieldNode = node.get(fieldName);
        if (fieldNode.isBoolean()) {
            return fieldNode.asBoolean();
        }
        return "true".equalsIgnoreCase(fieldNode.asText());
    }
    
    private Instant parseTimestamp(JsonNode node, String fieldName) {
        if (!node.has(fieldName) || node.get(fieldName).isNull()) {
            return null;
        }
        try {
            JsonNode tsNode = node.get(fieldName);
            if (tsNode.isNumber()) {
                // Debezium sends epoch micros
                long micros = tsNode.asLong();
                return Instant.ofEpochMilli(micros / 1000);
            } else {
                // ISO string format
                return Instant.parse(tsNode.asText());
            }
        } catch (Exception e) {
            log.warn("[CDC] Failed to parse timestamp field: {}", fieldName, e);
            return null;
        }
    }
    
    private UUID parseUUID(String value) {
        if (value == null) return null;
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            log.warn("[CDC] Invalid UUID format: {}", value);
            return null;
        }
    }
    
    private String truncate(String str, int maxLen) {
        return str.length() > maxLen ? str.substring(0, maxLen) + "..." : str;
    }
}

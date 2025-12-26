package com.example.exam.messaging;

import com.example.exam.model.UserShadowEntity;
import com.example.exam.repository.UserShadowRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * User CDC Consumer - Session Service
 * 
 * Listens to: exam-identity.public.users
 * Updates: user_shadow table
 * 
 * Features:
 * - Idempotent upsert (handles duplicate messages)
 * - Soft delete support  
 * - Tolerant reader (handles schema changes)
 * - Comprehensive error logging
 */
@Service
public class UserCDCConsumer {

    private static final Logger log = LoggerFactory.getLogger(UserCDCConsumer.class);
    
    private final UserShadowRepository userShadowRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public UserCDCConsumer(UserShadowRepository userShadowRepository) {
        this.userShadowRepository = userShadowRepository;
    }

    /**
     * Consume user change events from Kafka CDC
     * 
     * This method is IDEMPOTENT - can be called multiple times with same message
     * without causing inconsistency (important for at-least-once delivery)
     */
    @KafkaListener(
        topics = "exam-identity.public.users",
        groupId = "session-service-user-sync",
        containerFactory = "kafkaListenerContainerFactory"
    )
    @Transactional
    public void consumeUserChange(
            String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
            @Header(KafkaHeaders.OFFSET) Long offset,
            @Header(KafkaHeaders.RECEIVED_PARTITION) Integer partition
    ) {
        try {
            JsonNode event = objectMapper.readTree(message);
            
            // Extract operation type (c=create, u=update, d=delete, r=read/snapshot)
            String operation = getStringOrDefault(event, "__op", "r");
            String userId = getStringOrNull(event, "id");
            
            if (userId == null) {
                log.warn("[User CDC] Missing user ID in event. Topic={}, Partition={}, Offset={}", 
                    topic, partition, offset);
                return;
            }
            
            log.info("[User CDC] Processing event: userId={}, op={}, partition={}, offset={}", 
                userId, operation, partition, offset);
            
            switch (operation) {
                case "c", "r" -> handleCreateOrSnapshot(event, userId);
                case "u" -> handleUpdate(event, userId);
                case "d" -> handleDelete(event, userId);
                default -> log.warn("[User CDC] Unknown operation: {}", operation);
            }
            
        } catch (Exception e) {
            // Log error with full context for debugging
            log.error("[User CDC] Error processing event. Topic={}, Partition={}, Offset={}, Message={}", 
                topic, partition, offset, message, e);
            
            // Rethrow to trigger Kafka retry/DLQ mechanism
            throw new RuntimeException("Failed to process user CDC event", e);
        }
    }

    /**
     * Handle CREATE or SNAPSHOT events
     * Uses UPSERT to ensure idempotency
     */
    private void handleCreateOrSnapshot(JsonNode event, String userId) {
        String username = getStringOrNull(event, "username");
        String email = getStringOrNull(event, "email");
        String role = getStringOrNull(event, "role");
        Boolean enabled = getBooleanOrDefault(event, "enabled", true);
        
        // UPSERT: If exists, update. If not, create. This ensures idempotency.
        UserShadowEntity entity = userShadowRepository.findById(userId)
            .orElse(new UserShadowEntity());
        
        entity.setUserId(userId);
        entity.setUsername(username);
        entity.setEmail(email);
        entity.setRole(role);
        entity.setEnabled(enabled);
        entity.setDeleted(false); // Undelete if was soft-deleted
        entity.setSyncedAt(Instant.now());
        
        userShadowRepository.save(entity);
        
        log.info("[User CDC] Upserted user shadow: userId={}, username={}", userId, username);
    }

    /**
     * Handle UPDATE events
     * Same logic as create to ensure idempotency
     */
    private void handleUpdate(JsonNode event, String userId) {
        handleCreateOrSnapshot(event, userId);
    }

    /**
     * Handle DELETE events
     * Uses SOFT DELETE to preserve history
     */
    private void handleDelete(JsonNode event, String userId) {
        userShadowRepository.findById(userId).ifPresentOrElse(
            entity -> {
                // Soft delete
                entity.setDeleted(true);
                entity.setSyncedAt(Instant.now());
                userShadowRepository.save(entity);
                log.info("[User CDC] Soft-deleted user shadow: userId={}", userId);
            },
            () -> log.warn("[User CDC] Delete called for non-existent user: {}", userId)
        );
    }

    // === TOLERANT READER HELPERS ===
    // These methods safely extract fields even if schema changes
    
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
        return node.has(fieldName) && !node.get(fieldName).isNull() 
            ? node.get(fieldName).asBoolean() 
            : defaultValue;
    }
}

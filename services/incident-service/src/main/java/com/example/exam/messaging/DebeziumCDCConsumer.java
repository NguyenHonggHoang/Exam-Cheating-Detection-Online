package com.example.exam.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

/**
 * Kafka Consumer for Debezium CDC Events
 * 
 * HOW DEBEZIUM WORKS (The Magic):
 * ================================
 * 1. Debezium connects to PostgreSQL's Write-Ahead Log (WAL)
 * 2. PostgreSQL streams ALL database changes (INSERT/UPDATE/DELETE) to the WAL
 * 3. Debezium reads these changes WITHOUT touching the source service code
 * 4. Changes are published to Kafka topics in the format: {server}.{schema}.{table}
 * 5. This service consumes those topics to get real-time updates
 * 
 * KEY BENEFIT: Session Service doesn't need ANY Kafka code!
 * It just uses normal JPA (@Entity, save(), etc.) and Debezium captures everything.
 */
@Service
public class DebeziumCDCConsumer {

    private static final Logger log = LoggerFactory.getLogger(DebeziumCDCConsumer.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Listen to User updates from user_db
     * Topic format: {topic.prefix}.{database.server.name}.{schema}.{table}
     * Example: dbserver.userdb.public.users
     * 
     * Use Case: Update local student cache when user info changes
     */
    @KafkaListener(
        topics = "exam-identity.public.users",
        groupId = "incident-service-cdc"
    )
    public void consumeUserChanges(String message) {
        try {
            JsonNode event = objectMapper.readTree(message);
            
            // With SMT unwrap, we get the clean "after" state directly
            // Without unwrap, it would be: event.get("payload").get("after")
            String operation = event.has("__op") ? event.get("__op").asText() : "c";  // c=create, u=update, d=delete
            
            log.info("[CDC] User change detected: operation={}", operation);
            
            if ("d".equals(operation)) {
                // Handle DELETE
                String userId = event.get("id").asText();
                log.info("[CDC] User deleted: {}", userId);
                // TODO: Remove from cache
            } else {
                // Handle CREATE or UPDATE
                String userId = event.get("id").asText();
                String username = event.get("username").asText();
                log.info("[CDC] User upserted: id={}, username={}", userId, username);
                
                // TODO: Update local cache/denormalized table
                // Example: studentCache.put(userId, new StudentInfo(userId, username, ...));
            }
            
        } catch (Exception e) {
            log.error("[CDC] Error processing user change event", e);
        }
    }

    /**
     * Listen to Session updates from session_db
     * Topic: dbserver.sessiondb.public.sessions
     * 
     * Use Case: Track which sessions are active for incident correlation
     */
    @KafkaListener(
        topics = "exam-session.public.sessions",
        groupId = "incident-service-cdc"
    )
    public void consumeSessionChanges(String message) {
        try {
            JsonNode event = objectMapper.readTree(message);
            String operation = event.has("__op") ? event.get("__op").asText() : "c";
            
            log.info("[CDC] Session change detected: operation={}", operation);
            
            if ("d".equals(operation)) {
                String sessionId = event.get("id").asText();
                log.info("[CDC] Session deleted: {}", sessionId);
            } else {
                String sessionId = event.get("id").asText();
                String status = event.get("status").asText();
                log.info("[CDC] Session upserted: id={}, status={}", sessionId, status);
                
                // TODO: Update session tracking
                // If status == "ENDED", close any open incidents for this session
            }
            
        } catch (Exception e) {
            log.error("[CDC] Error processing session change event", e);
        }
    }

    /**
     * IMPORTANT NOTE ON DEBEZIUM MAGIC:
     * ==================================
     * The Session Service (source) does this:
     * 
     * @Entity
     * public class Session {
     *     // ... fields ...
     * }
     * 
     * sessionRepository.save(session);  // <-- Just normal JPA save
     * 
     * Behind the scenes:
     * 1. JPA writes to PostgreSQL
     * 2. PostgreSQL appends to WAL (because wal_level=logical)
     * 3. Debezium connector reads the WAL entry
     * 4. Debezium publishes JSON to Kafka topic
     * 5. This consumer receives the change
     * 
     * NO KAFKA CODE IN SESSION SERVICE! That's the magic.
     */
}

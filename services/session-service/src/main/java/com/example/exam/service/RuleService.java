package com.example.exam.service;

import com.example.exam.config.RabbitMQConfig;
import com.example.exam.dto.IncidentEventDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Service for evaluating cheating detection rules
 * 
 * Sends incident events to incident-service via RabbitMQ
 * following microservices principles.
 * 
 * @deprecated As of 2025-12-26, rule engine is tied to deprecated IngestService.
 * Rule-based detection is being refactored.
 * This will be removed in a future version.
 */
@Deprecated
@Service
public class RuleService {

    private static final Logger log = LoggerFactory.getLogger(RuleService.class);
    
    private final StringRedisTemplate redisTemplate;
    private final RabbitTemplate rabbitTemplate;

    // Rule thresholds
    private static final int TAB_SWITCH_THRESHOLD = 10;
    private static final int TAB_SWITCH_WINDOW_MINUTES = 5;
    private static final int PASTE_THRESHOLD = 3;
    private static final int PASTE_WINDOW_MINUTES = 2;

    public RuleService(StringRedisTemplate redisTemplate, RabbitTemplate rabbitTemplate) {
        this.redisTemplate = redisTemplate;
        this.rabbitTemplate = rabbitTemplate;
    }

    /**
     * Evaluate tab switch rule: if user switches tab > 10 times in 5 minutes -> send TAB_SWITCH incident event
     * 
     * @param sessionId Session ID
     * @param ts Timestamp of the tab switch event
     */
    public void evaluateTabSwitch(UUID sessionId, Instant ts) {
        try {
            // Calculate time window (round to minute)
            long minuteKey = ts.getEpochSecond() / 60;
            
            // Redis key: session:{sessionId}:tabswitch:{minute}
            String redisKey = String.format("session:%s:tabswitch:%d", sessionId, minuteKey);
            
            // Increment counter
            Long count = redisTemplate.opsForValue().increment(redisKey);
            
            // Set expiration (5 minutes + buffer)
            if (count != null && count == 1) {
                redisTemplate.expire(redisKey, Duration.ofMinutes(TAB_SWITCH_WINDOW_MINUTES + 1));
            }
            
            log.debug("Tab switch count for session {} at minute {}: {}", sessionId, minuteKey, count);
            
            // Check if threshold exceeded
            if (count != null && count > TAB_SWITCH_THRESHOLD) {
                // Check if incident already sent for this time window
                String incidentCheckKey = String.format("session:%s:tababuse:incident:%d", sessionId, minuteKey);
                Boolean alreadyCreated = redisTemplate.opsForValue().setIfAbsent(
                    incidentCheckKey, 
                    "1", 
                    Duration.ofMinutes(TAB_SWITCH_WINDOW_MINUTES + 1)
                );
                
                if (Boolean.TRUE.equals(alreadyCreated)) {
                    sendTabAbuseEvent(sessionId, ts, count.intValue());
                    log.info("TAB_SWITCH incident event sent for session {} - count: {}", sessionId, count);
                }
            }
        } catch (Exception e) {
            log.error("Error evaluating tab switch rule for session {}", sessionId, e);
        }
    }

    /**
     * Send TAB_SWITCH incident event to incident-service
     */
    private void sendTabAbuseEvent(UUID sessionId, Instant ts, int count) {
        IncidentEventDto event = IncidentEventDto.builder()
                .sessionId(sessionId)
                .type("TAB_SWITCH")
                .timestamp(ts.toEpochMilli())
                .score(calculateTabAbuseScore(count))
                .reason(String.format("Tab switched %d times in %d minutes (threshold: %d)", 
                        count, TAB_SWITCH_WINDOW_MINUTES, TAB_SWITCH_THRESHOLD))
                .detectedBy("RULE_ENGINE")
                .eventTime(Instant.now())
                .build();
        
        sendIncidentEvent(event);
    }

    /**
     * Calculate severity score for tab abuse (0.0 - 1.0)
     */
    private BigDecimal calculateTabAbuseScore(int count) {
        // Linear scale: 11 switches = 0.5, 20 switches = 1.0
        double score = Math.min(1.0, (count - TAB_SWITCH_THRESHOLD) / 10.0 + 0.5);
        score = Math.round(score * 100) / 100.0; // Round to 2 decimals
        return BigDecimal.valueOf(score);
    }

    /**
     * Get tab switch count for a session in current time window
     */
    public int getTabSwitchCount(UUID sessionId) {
        try {
            long currentMinute = Instant.now().getEpochSecond() / 60;
            String redisKey = String.format("session:%s:tabswitch:%d", sessionId, currentMinute);
            String value = redisTemplate.opsForValue().get(redisKey);
            return value != null ? Integer.parseInt(value) : 0;
        } catch (Exception e) {
            log.error("Error getting tab switch count for session {}", sessionId, e);
            return 0;
        }
    }

    /**
     * Evaluate paste rule: if user pastes > 3 times in 2 minutes -> send PASTE incident event
     * 
     * @param sessionId Session ID
     * @param ts Timestamp of the paste event
     */
    public void evaluatePaste(UUID sessionId, Instant ts) {
        try {
            // Calculate time window (round to minute)
            long minuteKey = ts.getEpochSecond() / 60;
            
            // Redis key: session:{sessionId}:paste:{minute}
            String redisKey = String.format("session:%s:paste:%d", sessionId, minuteKey);
            
            // Increment counter
            Long count = redisTemplate.opsForValue().increment(redisKey);
            
            // Set expiration (2 minutes + buffer)
            if (count != null && count == 1) {
                redisTemplate.expire(redisKey, Duration.ofMinutes(PASTE_WINDOW_MINUTES + 1));
            }
            
            log.debug("Paste count for session {} at minute {}: {}", sessionId, minuteKey, count);
            
            // Check if threshold exceeded
            if (count != null && count > PASTE_THRESHOLD) {
                // Check if incident already sent for this time window
                String incidentCheckKey = String.format("session:%s:paste:incident:%d", sessionId, minuteKey);
                Boolean alreadyCreated = redisTemplate.opsForValue().setIfAbsent(
                    incidentCheckKey, 
                    "1", 
                    Duration.ofMinutes(PASTE_WINDOW_MINUTES + 1)
                );
                
                if (Boolean.TRUE.equals(alreadyCreated)) {
                    sendPasteEvent(sessionId, ts, count.intValue());
                    log.info("PASTE incident event sent for session {} - count: {}", sessionId, count);
                }
            }
        } catch (Exception e) {
            log.error("Error evaluating paste rule for session {}", sessionId, e);
        }
    }

    /**
     * Send PASTE incident event to incident-service
     */
    private void sendPasteEvent(UUID sessionId, Instant ts, int count) {
        IncidentEventDto event = IncidentEventDto.builder()
                .sessionId(sessionId)
                .type("PASTE")
                .timestamp(ts.toEpochMilli())
                .score(calculatePasteScore(count))
                .reason(String.format("Pasted %d times in %d minutes (threshold: %d)", 
                        count, PASTE_WINDOW_MINUTES, PASTE_THRESHOLD))
                .detectedBy("RULE_ENGINE")
                .eventTime(Instant.now())
                .build();
        
        sendIncidentEvent(event);
    }

    /**
     * Calculate severity score for paste abuse (0.0 - 1.0)
     */
    private BigDecimal calculatePasteScore(int count) {
        // Linear scale: 4 pastes = 0.6, 6+ pastes = 1.0
        double score = Math.min(1.0, (count - PASTE_THRESHOLD) / 3.0 + 0.6);
        score = Math.round(score * 100) / 100.0; // Round to 2 decimals
        return BigDecimal.valueOf(score);
    }
    
    /**
     * Send incident event to incident-service via RabbitMQ
     */
    private void sendIncidentEvent(IncidentEventDto event) {
        try {
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.EXCHANGE_NAME,
                    RabbitMQConfig.INCIDENT_ROUTING_KEY,
                    event
            );
            log.debug("Sent incident event: sessionId={}, type={}", 
                    event.sessionId(), event.type());
        } catch (Exception ex) {
            log.error("Failed to send incident event: sessionId={}, type={}, error={}", 
                    event.sessionId(), event.type(), ex.getMessage(), ex);
        }
    }
}

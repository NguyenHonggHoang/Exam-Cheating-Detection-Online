package com.example.exam.service;

import com.example.exam.model.Incident;
import com.example.exam.model.IncidentStatus;
import com.example.exam.model.IncidentType;
import com.example.exam.repository.IncidentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Service for evaluating cheating detection rules
 */
@Service
public class RuleService {

    private static final Logger log = LoggerFactory.getLogger(RuleService.class);
    
    private final StringRedisTemplate redisTemplate;
    private final IncidentRepository incidentRepository;

    // Rule thresholds
    private static final int TAB_SWITCH_THRESHOLD = 10;
    private static final int TAB_SWITCH_WINDOW_MINUTES = 5;
    private static final int PASTE_THRESHOLD = 3;
    private static final int PASTE_WINDOW_MINUTES = 2;

    public RuleService(StringRedisTemplate redisTemplate, IncidentRepository incidentRepository) {
        this.redisTemplate = redisTemplate;
        this.incidentRepository = incidentRepository;
    }

    /**
     * Evaluate tab switch rule: if user switches tab > 10 times in 5 minutes -> create TAB_ABUSE incident
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
                // Check if incident already created for this time window
                String incidentCheckKey = String.format("session:%s:tababuse:incident:%d", sessionId, minuteKey);
                Boolean alreadyCreated = redisTemplate.opsForValue().setIfAbsent(
                    incidentCheckKey, 
                    "1", 
                    Duration.ofMinutes(TAB_SWITCH_WINDOW_MINUTES + 1)
                );
                
                if (Boolean.TRUE.equals(alreadyCreated)) {
                    createTabAbuseIncident(sessionId, ts, count.intValue());
                    log.info("TAB_ABUSE incident created for session {} - count: {}", sessionId, count);
                }
            }
        } catch (Exception e) {
            log.error("Error evaluating tab switch rule for session {}", sessionId, e);
        }
    }

    /**
     * Create TAB_ABUSE incident
     */
    private void createTabAbuseIncident(UUID sessionId, Instant ts, int count) {
        Incident incident = new Incident();
        incident.setSessionId(sessionId);
        incident.setType(IncidentType.TAB_ABUSE);
        incident.setTs(ts.toEpochMilli()); // Store as milliseconds
        incident.setScore(calculateTabAbuseScore(count));
        incident.setReason(String.format("Tab switched %d times in %d minutes (threshold: %d)", 
                count, TAB_SWITCH_WINDOW_MINUTES, TAB_SWITCH_THRESHOLD));
        incident.setStatus(IncidentStatus.OPEN);
        incident.setCreatedAt(Instant.now());
        
        incidentRepository.save(incident);
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
     * Evaluate paste rule: if user pastes > 3 times in 2 minutes -> create PASTE incident
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
                // Check if incident already created for this time window
                String incidentCheckKey = String.format("session:%s:paste:incident:%d", sessionId, minuteKey);
                Boolean alreadyCreated = redisTemplate.opsForValue().setIfAbsent(
                    incidentCheckKey, 
                    "1", 
                    Duration.ofMinutes(PASTE_WINDOW_MINUTES + 1)
                );
                
                if (Boolean.TRUE.equals(alreadyCreated)) {
                    createPasteIncident(sessionId, ts, count.intValue());
                    log.info("PASTE incident created for session {} - count: {}", sessionId, count);
                }
            }
        } catch (Exception e) {
            log.error("Error evaluating paste rule for session {}", sessionId, e);
        }
    }

    /**
     * Create PASTE incident
     */
    private void createPasteIncident(UUID sessionId, Instant ts, int count) {
        Incident incident = new Incident();
        incident.setSessionId(sessionId);
        incident.setType(IncidentType.PASTE);
        incident.setTs(ts.toEpochMilli());
        incident.setScore(calculatePasteScore(count));
        incident.setReason(String.format("Pasted %d times in %d minutes (threshold: %d)", 
                count, PASTE_WINDOW_MINUTES, PASTE_THRESHOLD));
        incident.setStatus(IncidentStatus.OPEN);
        incident.setCreatedAt(Instant.now());
        
        incidentRepository.save(incident);
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
}

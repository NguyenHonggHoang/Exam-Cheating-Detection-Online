package com.example.exam.service;

import com.example.exam.dto.IncidentDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * SSE Emitter Service - Manages Server-Sent Event connections
 * 
 * Handles:
 * - Connection management (add/remove emitters)
 * - Broadcasting incidents to all connected proctors
 * - Exam-specific subscriptions
 * - Heartbeat to keep connections alive
 */
@Service
@Slf4j
public class SseEmitterService {

    // All active connections (proctor ID -> emitter)
    private final Map<String, SseEmitter> allEmitters = new ConcurrentHashMap<>();
    
    // Connections by exam (examId -> list of emitters)
    private final Map<String, List<SseEmitter>> examEmitters = new ConcurrentHashMap<>();
    
    // Default timeout: 30 minutes
    private static final long SSE_TIMEOUT = 30 * 60 * 1000L;

    /**
     * Create a new SSE connection for a proctor
     * 
     * @param proctorId Unique identifier for the proctor
     * @return SseEmitter instance
     */
    public SseEmitter createEmitter(String proctorId) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);
        
        // Clean up on completion/timeout/error
        emitter.onCompletion(() -> {
            log.info("SSE connection completed for proctor: {}", proctorId);
            removeEmitter(proctorId);
        });
        
        emitter.onTimeout(() -> {
            log.info("SSE connection timed out for proctor: {}", proctorId);
            removeEmitter(proctorId);
        });
        
        emitter.onError(e -> {
            log.warn("SSE connection error for proctor: {}", proctorId, e);
            removeEmitter(proctorId);
        });
        
        // Remove old connection if exists
        if (allEmitters.containsKey(proctorId)) {
            SseEmitter old = allEmitters.get(proctorId);
            try {
                old.complete();
            } catch (Exception ignored) {}
        }
        
        allEmitters.put(proctorId, emitter);
        log.info("SSE connection created for proctor: {}. Total connections: {}", 
                proctorId, allEmitters.size());
        
        // Send initial connection message
        try {
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data("{\"status\":\"connected\",\"timestamp\":" + System.currentTimeMillis() + "}"));
        } catch (IOException e) {
            log.error("Failed to send initial message", e);
        }
        
        return emitter;
    }

    /**
     * Create SSE connection for specific exam
     */
    public SseEmitter createEmitterForExam(String proctorId, String examId) {
        SseEmitter emitter = createEmitter(proctorId + "_" + examId);
        
        examEmitters.computeIfAbsent(examId, k -> new CopyOnWriteArrayList<>()).add(emitter);
        
        return emitter;
    }

    /**
     * Remove an emitter when connection closes
     */
    private void removeEmitter(String proctorId) {
        allEmitters.remove(proctorId);
        log.debug("Removed SSE emitter: {}. Remaining: {}", proctorId, allEmitters.size());
    }

    /**
     * Broadcast new incident to all connected proctors
     * 
     * @param incident The incident DTO to broadcast
     */
    public void broadcastIncident(IncidentDto.Response incident) {
        log.info("Broadcasting incident {} to {} proctors", incident.getId(), allEmitters.size());
        
        allEmitters.forEach((proctorId, emitter) -> {
            try {
                emitter.send(SseEmitter.event()
                        .name("new-incident")
                        .data(incident));
                log.debug("Sent incident {} to proctor {}", incident.getId(), proctorId);
            } catch (IOException e) {
                log.warn("Failed to send to proctor {}, removing emitter", proctorId);
                removeEmitter(proctorId);
            }
        });
        
        // Also broadcast to exam-specific subscribers
        String examId = incident.getExamId();
        if (examId != null && examEmitters.containsKey(examId)) {
            List<SseEmitter> emitters = examEmitters.get(examId);
            List<SseEmitter> deadEmitters = new CopyOnWriteArrayList<>();
            
            emitters.forEach(emitter -> {
                try {
                    emitter.send(SseEmitter.event()
                            .name("new-incident")
                            .data(incident));
                } catch (IOException e) {
                    deadEmitters.add(emitter);
                }
            });
            
            // Clean up dead connections
            emitters.removeAll(deadEmitters);
        }
    }

    /**
     * Broadcast incident status update
     */
    public void broadcastStatusUpdate(UUID incidentId, String newStatus) {
        log.info("Broadcasting status update {} -> {} to {} proctors", 
                incidentId, newStatus, allEmitters.size());
        
        String data = String.format("{\"incidentId\":\"%s\",\"status\":\"%s\",\"timestamp\":%d}",
                incidentId, newStatus, System.currentTimeMillis());
        
        allEmitters.forEach((proctorId, emitter) -> {
            try {
                emitter.send(SseEmitter.event()
                        .name("status-update")
                        .data(data));
            } catch (IOException e) {
                removeEmitter(proctorId);
            }
        });
    }

    /**
     * Send heartbeat to keep connections alive
     */
    public void sendHeartbeat() {
        String heartbeat = "{\"type\":\"heartbeat\",\"timestamp\":" + System.currentTimeMillis() + "}";
        
        allEmitters.forEach((proctorId, emitter) -> {
            try {
                emitter.send(SseEmitter.event()
                        .name("heartbeat")
                        .data(heartbeat));
            } catch (IOException e) {
                removeEmitter(proctorId);
            }
        });
    }

    /**
     * Get connection count for monitoring
     */
    public int getConnectionCount() {
        return allEmitters.size();
    }
}

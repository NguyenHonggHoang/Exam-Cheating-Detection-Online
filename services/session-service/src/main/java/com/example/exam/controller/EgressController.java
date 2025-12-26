package com.example.exam.controller;

import com.example.exam.service.EgressService;
import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Controller for LiveKit Egress operations
 * 
 * Allows frontend to trigger server-side video recording
 */
@RestController
@RequestMapping("/api/egress")
@Tag(name = "Egress", description = "LiveKit video recording operations")
public class EgressController {
    
    private static final Logger log = LoggerFactory.getLogger(EgressController.class);
    
    private final EgressService egressService;
    
    public EgressController(EgressService egressService) {
        this.egressService = egressService;
    }
    
    /**
     * Start recording when violation detected
     * 
     * Called by frontend after TF.js detects a violation
     * Records the room/track for specified duration
     */
    @PostMapping("/start")
    @Operation(summary = "Start video recording",
               description = "Start recording room video when violation detected")
    public ResponseEntity<Map<String, Object>> startRecording(
            @RequestBody StartRecordingRequest request) {
        
        log.info("Start recording request: session={}, room={}, violation={}", 
                request.sessionId, request.roomName, request.violationType);
        
        try {
            String egressId;
            
            if (request.trackId != null && !request.trackId.isEmpty()) {
                // Record specific track
                egressId = egressService.startTrackRecording(
                        request.roomName,
                        request.trackId,
                        request.sessionId,
                        request.violationType,
                        request.durationSeconds != null ? request.durationSeconds : 10
                );
            } else {
                // Record entire room
                egressId = egressService.startRoomRecording(
                        request.roomName,
                        request.sessionId,
                        request.violationType,
                        request.durationSeconds != null ? request.durationSeconds : 10
                );
            }
            
            return ResponseEntity.accepted().body(Map.of(
                    "status", "recording",
                    "egressId", egressId,
                    "message", "Recording started",
                    "durationSeconds", request.durationSeconds != null ? request.durationSeconds : 10
            ));
            
        } catch (Exception e) {
            log.error("Failed to start recording: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "status", "error",
                    "message", e.getMessage()
            ));
        }
    }
    
    /**
     * Stop an active recording
     */
    @PostMapping("/stop/{egressId}")
    @Operation(summary = "Stop recording", description = "Stop an active recording")
    public ResponseEntity<Map<String, Object>> stopRecording(
            @PathVariable String egressId) {
        
        log.info("Stop recording request: egressId={}", egressId);
        
        try {
            egressService.stopRecording(egressId);
            
            return ResponseEntity.ok(Map.of(
                    "status", "stopped",
                    "egressId", egressId
            ));
            
        } catch (Exception e) {
            log.error("Failed to stop recording: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "status", "error",
                    "message", e.getMessage()
            ));
        }
    }
    
    /**
     * List active recordings
     */
    @GetMapping("/active")
    @Operation(summary = "List active recordings")
    public ResponseEntity<Map<String, Object>> listActive() {
        var recordings = egressService.getActiveRecordings();
        
        return ResponseEntity.ok(Map.of(
                "count", recordings.size(),
                "recordings", recordings.keySet()
        ));
    }
    
    /**
     * Webhook endpoint for LiveKit Egress events
     * 
     * LiveKit will call this when egress status changes:
     * - egress_started: Recording started
     * - egress_updated: Recording in progress
     * - egress_ended: Recording completed (SUCCESS or FAILED)
     */
    @PostMapping("/webhook")
    @Operation(summary = "Egress webhook", description = "Receives LiveKit egress events")
    public ResponseEntity<String> handleWebhook(
            @RequestBody String body,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        
        log.info("Egress webhook received");
        
        try {
            // Parse webhook body as JSON
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode root = mapper.readTree(body);
            
            String event = root.has("event") ? root.get("event").asText() : "";
            log.info("Webhook event type: {}", event);
            
            // Handle egress events
            if (event.equals("egress_ended")) {
                JsonNode egressInfo = root.get("egressInfo");
                if (egressInfo != null) {
                    String egressId = egressInfo.has("egressId") ? egressInfo.get("egressId").asText() : null;
                    String status = egressInfo.has("status") ? egressInfo.get("status").asText() : "";
                    
                    log.info("Egress ended: egressId={}, status={}", egressId, status);
                    
                    // Check if egress completed successfully
                    if ("EGRESS_COMPLETE".equals(status) && egressId != null) {
                        // Get file info from the response
                        String fileUrl = null;
                        long fileSize = 0;
                        
                        // Check for file results
                        if (egressInfo.has("fileResults") && egressInfo.get("fileResults").isArray()) {
                            JsonNode fileResults = egressInfo.get("fileResults");
                            if (fileResults.size() > 0) {
                                JsonNode firstFile = fileResults.get(0);
                                fileUrl = firstFile.has("location") ? firstFile.get("location").asText() : null;
                                fileSize = firstFile.has("size") ? firstFile.get("size").asLong() : 0;
                            }
                        }
                        
                        log.info("Egress file ready: url={}, size={}", fileUrl, fileSize);
                        
                        // Notify service to queue for AI analysis
                        egressService.handleEgressWebhook(egressId, status, fileUrl, fileSize);
                    } else if ("EGRESS_FAILED".equals(status)) {
                        log.error("Egress failed: egressId={}", egressId);
                        // Could notify for retry or alerting
                    }
                }
            } else if (event.equals("egress_started")) {
                log.info("Egress started - recording in progress");
            }
            
            return ResponseEntity.ok("OK");
            
        } catch (Exception e) {
            log.error("Failed to parse webhook: {}", e.getMessage(), e);
            // Still return OK to prevent LiveKit retries for parse errors
            return ResponseEntity.ok("OK");
        }
    }
    
    /**
     * Request body for starting recording
     */
    public static class StartRecordingRequest {
        public UUID sessionId;
        public String roomName;
        public String trackId;  // Optional: specific track to record
        public String violationType;
        public Integer durationSeconds;  // Default: 10 seconds
        
        // Getters and setters
        public UUID getSessionId() { return sessionId; }
        public void setSessionId(UUID sessionId) { this.sessionId = sessionId; }
        
        public String getRoomName() { return roomName; }
        public void setRoomName(String roomName) { this.roomName = roomName; }
        
        public String getTrackId() { return trackId; }
        public void setTrackId(String trackId) { this.trackId = trackId; }
        
        public String getViolationType() { return violationType; }
        public void setViolationType(String violationType) { this.violationType = violationType; }
        
        public Integer getDurationSeconds() { return durationSeconds; }
        public void setDurationSeconds(Integer durationSeconds) { this.durationSeconds = durationSeconds; }
    }
}

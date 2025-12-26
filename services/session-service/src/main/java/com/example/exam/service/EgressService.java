package com.example.exam.service;

import com.example.exam.config.RabbitMQConfig;
import com.example.exam.dto.VideoAnalysisMessage;
import io.livekit.server.*;
import livekit.LivekitEgress;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * LiveKit Egress Service
 * 
 * Handles server-side video recording via LiveKit Egress API
 * Records specific tracks and outputs to MinIO
 */
@Service
public class EgressService {
    
    private static final Logger log = LoggerFactory.getLogger(EgressService.class);
    
    @Value("${livekit.api-key}")
    private String apiKey;
    
    @Value("${livekit.api-secret}")
    private String apiSecret;
    
    @Value("${livekit.host}")
    private String livekitHost;
    
    @Value("${minio.endpoint}")
    private String minioEndpoint;
    
    @Value("${minio.external-endpoint:${minio.endpoint}}")
    private String minioExternalEndpoint;
    
    @Value("${minio.access-key}")
    private String minioAccessKey;
    
    @Value("${minio.secret-key}")
    private String minioSecretKey;
    
    @Value("${minio.bucket.evidence:exam-evidence}")
    private String evidenceBucket;
    
    private final RabbitTemplate rabbitTemplate;
    private final RestTemplate restTemplate;
    
    // Track active egress sessions
    private final Map<String, EgressInfo> activeEgress = new ConcurrentHashMap<>();
    
    @Value("${incident-service.url:http://incident-service:8082}")
    private String incidentServiceUrl;
    
    public EgressService(RabbitTemplate rabbitTemplate, RestTemplateBuilder restTemplateBuilder) {
        this.rabbitTemplate = rabbitTemplate;
        this.restTemplate = restTemplateBuilder.build();
    }
    
    /**
     * Start recording a room (all tracks)
     * 
     * @param roomName Room to record
     * @param sessionId Exam session ID
     * @param durationSeconds How long to record
     * @return Egress ID
     */
    public String startRoomRecording(String roomName, UUID sessionId, String violationType, int durationSeconds) {
        log.info("Starting room recording: room={}, session={}, violation={}, duration={}s", 
                roomName, sessionId, violationType, durationSeconds);
        
        try {
            EgressServiceClient egressClient = createEgressClient();
            
            // Output file path in MinIO
            String outputPath = String.format("sessions/%s/clips/room_%d.mp4", 
                    sessionId, System.currentTimeMillis());
            
            // S3 upload configuration for MinIO
            LivekitEgress.S3Upload s3Upload = LivekitEgress.S3Upload.newBuilder()
                    .setEndpoint(minioEndpoint)
                    .setAccessKey(minioAccessKey)
                    .setSecret(minioSecretKey)
                    .setBucket(evidenceBucket)
                    .setRegion("us-east-1")  // MinIO doesn't care about region
                    .setForcePathStyle(true)  // Required for MinIO
                    .build();
            
            LivekitEgress.EncodedFileOutput fileOutput = LivekitEgress.EncodedFileOutput.newBuilder()
                    .setFileType(LivekitEgress.EncodedFileType.MP4)
                    .setFilepath(outputPath)
                    .setS3(s3Upload)
                    .build();
            
            // Start room composite egress
            // Method signature: startRoomCompositeEgress(String roomName, EncodedFileOutput file)
            // Note: Layout argument is not available in basic overload, defaulting
            LivekitEgress.EgressInfo egressInfo = egressClient.startRoomCompositeEgress(roomName, fileOutput).execute().body();
            
            // Check if room exists and egress started successfully
            if (egressInfo == null) {
                log.error("Failed to start room recording: room={} - room may not exist or no participants", roomName);
                throw new RuntimeException("Room does not exist or has no participants. Ensure candidate has joined before recording.");
            }
            
            String egressId = egressInfo.getEgressId();
            
            // Track active egress with violation info
            EgressInfo info = new EgressInfo(egressId, roomName, sessionId, outputPath, System.currentTimeMillis());
            info.setViolationType(violationType);
            activeEgress.put(egressId, info);
            
            log.info("Room recording started: egressId={}, output={}, violation={}", egressId, outputPath, violationType);
            
            // Schedule stop after duration
            if (durationSeconds > 0) {
                scheduleStop(egressId, durationSeconds);
            }
            
            return egressId;
            
        } catch (Exception e) {
            log.error("Failed to start room recording: room={}, error={}", roomName, e.getMessage(), e);
            throw new RuntimeException("Failed to start recording: " + e.getMessage(), e);
        }
    }
    
    /**
     * Start recording a specific participant's track
     * 
     * @param roomName Room name
     * @param trackId Track SID to record
     * @param sessionId Exam session ID
     * @param violationType Initial violation type that triggered recording
     * @param durationSeconds Recording duration
     * @return Egress ID
     */
    public String startTrackRecording(String roomName, String trackId, UUID sessionId, 
                                       String violationType, int durationSeconds) {
        log.info("Starting track recording: room={}, track={}, session={}, violation={}", 
                roomName, trackId, sessionId, violationType);
        
        try {
            EgressServiceClient egressClient = createEgressClient();
            
            // Output file path
            String outputPath = String.format("sessions/%s/clips/%s_%d.mp4", 
                    sessionId, violationType.toLowerCase(), System.currentTimeMillis());
            
            // S3 upload for MinIO
            LivekitEgress.S3Upload s3Upload = LivekitEgress.S3Upload.newBuilder()
                    .setEndpoint(minioEndpoint)
                    .setAccessKey(minioAccessKey)
                    .setSecret(minioSecretKey)
                    .setBucket(evidenceBucket)
                    .setRegion("us-east-1")
                    .setForcePathStyle(true)
                    .build();
            
            // NOTE: Video frame duplication/stuttering issues
            // DirectFileOutput records raw track without re-encoding, which can cause:
            // - Frame duplication if track has duplicate frames
            // - Stuttering if frame rate is inconsistent
            // 
            // Solutions:
            // 1. Use EncodedFileOutput if LiveKit API supports it (may require different method)
            // 2. Use track composite egress instead of track egress (requires layout configuration)
            // 3. Post-process video after recording to remove duplicate frames
            // 4. Ensure track publishing is stable (no frame drops/duplicates at source)
            //
            // For now, using DirectFileOutput as track egress requires it.
            // Frame duplication should be minimal if track source is stable.
            LivekitEgress.DirectFileOutput fileOutput = LivekitEgress.DirectFileOutput.newBuilder()
                    .setFilepath(outputPath)
                    .setS3(s3Upload)
                    .build();
            
            // Start track egress
            // Note: If frame duplication occurs, consider using track composite egress with encoding
            LivekitEgress.EgressInfo egressInfo = egressClient.startTrackEgress(roomName, fileOutput, trackId).execute().body();
            
            // Check if room/track exists and egress started successfully
            if (egressInfo == null) {
                log.error("Failed to start track recording: room={}, track={} - room/track may not exist", roomName, trackId);
                throw new RuntimeException("Room or track does not exist. Ensure candidate has joined and is publishing video.");
            }
            
            String egressId = egressInfo.getEgressId();
            
            // Track active egress with violation info
            EgressInfo info = new EgressInfo(egressId, roomName, sessionId, outputPath, System.currentTimeMillis());
            info.setViolationType(violationType);
            activeEgress.put(egressId, info);
            
            log.info("Track recording started: egressId={}, output={}", egressId, outputPath);
            
            // Schedule stop
            if (durationSeconds > 0) {
                scheduleStop(egressId, durationSeconds);
            }
            
            return egressId;
            
        } catch (Exception e) {
            log.error("Failed to start track recording: error={}", e.getMessage(), e);
            throw new RuntimeException("Failed to start track recording: " + e.getMessage(), e);
        }
    }
    
    /**
     * Stop an active recording
     */
    public void stopRecording(String egressId) {
        log.info("Stopping recording: egressId={}", egressId);
        
        try {
            EgressServiceClient egressClient = createEgressClient();
            LivekitEgress.EgressInfo result = egressClient.stopEgress(egressId).execute().body();
            
            log.info("Recording stopped: egressId={}, status={}", egressId, result.getStatus());
            
            // Handle completion
            handleEgressComplete(egressId, result);
            
        } catch (Exception e) {
            log.error("Failed to stop recording: egressId={}, error={}", egressId, e.getMessage(), e);
        }
    }
    
    /**
     * Handle egress completion - queue video for AI analysis
     */
    public void handleEgressComplete(String egressId, LivekitEgress.EgressInfo egressInfo) {
        EgressInfo info = activeEgress.remove(egressId);
        if (info == null) {
            log.warn("Unknown egress completed: {}", egressId);
            return;
        }
        
        log.info("Egress completed: egressId={}, session={}, status={}", 
                egressId, info.sessionId, egressInfo.getStatus());
        
        // Accept both EGRESS_COMPLETE and EGRESS_ENDING status
        // When stopRecording is called, status is EGRESS_ENDING (file still uploading)
        // But video is already recorded and can be queued for analysis
        if (egressInfo.getStatus() == LivekitEgress.EgressStatus.EGRESS_COMPLETE ||
            egressInfo.getStatus() == LivekitEgress.EgressStatus.EGRESS_ENDING) {
            // Build public URL for MinIO using external endpoint
            String publicUrl = String.format("%s/%s/%s", 
                    minioExternalEndpoint,
                    evidenceBucket, 
                    info.outputPath);
            
            // Extract objectKey from outputPath
            String objectKey = String.format("%s/%s", evidenceBucket, info.outputPath);
            
            log.info("Egress video ready: url={}, objectKey={}", publicUrl, objectKey);
            
            // Send event to incident service to update/create incident with video URL
            // Note: fileSize is not available from egressInfo, use 0 as placeholder
            sendEgressCompletedEvent(info, publicUrl, objectKey, 0L);
            
            // COMMENTED: Queue for Python AI analysis
            // Logic này đã được thay thế bằng pre-suspicion detection và proctor review
            // Video sẽ được hiển thị ở trang pre-suspicion cho proctor xem xét
            // queueVideoForAnalysis(info, publicUrl, 0L);
        } else {
            log.warn("Egress not complete, skipping queue: status={}", egressInfo.getStatus());
        }
    }
    
    /**
     * Handle egress webhook from LiveKit
     * Called when egress recording completes via webhook notification
     * 
     * @param egressId The egress ID
     * @param status The completion status (EGRESS_COMPLETE, EGRESS_FAILED)
     * @param fileUrl The S3/MinIO URL of the recorded file (may be internal path)
     * @param fileSize The file size in bytes
     */
    public void handleEgressWebhook(String egressId, String status, String fileUrl, long fileSize) {
        EgressInfo info = activeEgress.remove(egressId);
        
        if (info == null) {
            log.warn("Webhook for unknown egress: {} - may have already been processed", egressId);
            return;
        }
        
        log.info("Processing egress webhook: egressId={}, session={}, status={}", 
                egressId, info.sessionId, status);
        
        if ("EGRESS_COMPLETE".equals(status)) {
            // Build public URL for MinIO using external endpoint
            String publicUrl;
            if (fileUrl != null && !fileUrl.isEmpty()) {
                // Use the URL from webhook if available, but fix internal references
                publicUrl = fileUrl
                        .replace("http://minio:9000", minioExternalEndpoint)
                        .replace("minio:9000", minioExternalEndpoint.replace("http://", ""));
            } else {
                // Fall back to constructed URL
                publicUrl = String.format("%s/%s/%s", 
                        minioExternalEndpoint,
                        evidenceBucket, 
                        info.outputPath);
            }
            
            // Extract objectKey from outputPath
            // outputPath format: sessions/{sessionId}/clips/{violationType}_{timestamp}.mp4
            // objectKey should be: {evidenceBucket}/{outputPath}
            String objectKey = String.format("%s/%s", evidenceBucket, info.outputPath);
            
            log.info("Egress video ready: url={}, objectKey={}, size={}", publicUrl, objectKey, fileSize);
            
            // Send event to incident service to update/create incident with video URL
            sendEgressCompletedEvent(info, publicUrl, objectKey, fileSize);
            
            // COMMENTED: Queue for Python AI analysis
            // Logic này đã được thay thế bằng pre-suspicion detection và proctor review
            // queueVideoForAnalysis(info, publicUrl, fileSize);
        } else {
            log.error("Egress failed: egressId={}, status={}", egressId, status);
        }
    }
    
    /**
     * Send event to incident service when egress recording completes
     * This updates or creates incident with video URL and objectKey
     */
    private void sendEgressCompletedEvent(EgressInfo info, String publicUrl, String objectKey, long fileSize) {
        try {
            log.info("🎥 Egress video completed - preparing to send to incident service");
            log.info("📦 Video Evidence Details:");
            log.info("   - Session ID: {}", info.sessionId);
            log.info("   - Violation Type: {}", info.violationType != null ? info.violationType : "UNKNOWN");
            log.info("   - Public URL: {}", publicUrl);
            log.info("   - Object Key: {}", objectKey);
            log.info("   - File Size: {} bytes", fileSize);
            log.info("   - Video Format: {}", objectKey.contains(".mp4") ? "MP4" : objectKey.contains(".webm") ? "WebM" : "Unknown");
            
            // Build client event request
            Map<String, Object> request = new HashMap<>();
            request.put("sessionId", info.sessionId.toString());
            request.put("eventType", "EVIDENCE_CLIP");  // Use EVIDENCE_CLIP to match frontend upload
            request.put("violationType", info.violationType != null ? info.violationType : "UNKNOWN");
            request.put("violationState", "ESCALATED");  // Egress recordings are for serious violations
            request.put("evidenceUrl", publicUrl);
            request.put("objectKey", objectKey);  // Critical: objectKey for MinIO access
            request.put("fileSize", fileSize);
            request.put("timestamp", info.startTime);
            request.put("source", "EGRESS_RECORDING");
            
            // Send HTTP POST to incident service
            String url = incidentServiceUrl + "/api/incident/client-event";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);
            
            ResponseEntity<Void> response = restTemplate.postForEntity(url, entity, Void.class);
            
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("✅ Egress video evidence sent successfully to incident service");
                log.info("🎬 Incident will be created with video objectKey: {}", objectKey);
            } else {
                log.warn("⚠️ Failed to send egress completed event: status={}", response.getStatusCode());
            }
        } catch (Exception e) {
            // Non-blocking: log error but don't fail egress completion
            log.error("❌ Failed to send egress completed event to incident service: session={}, error={}", 
                    info.sessionId, e.getMessage(), e);
        }
    }
    
    /**
     * COMMENTED: Queue video for Python AI analysis
     * Logic này đã được thay thế bằng pre-suspicion detection và proctor review
     * Video sẽ được hiển thị ở trang pre-suspicion cho proctor xem xét
     */
    /*
    private void queueVideoForAnalysis(EgressInfo info, String publicUrl, long fileSize) {
        VideoAnalysisMessage message = new VideoAnalysisMessage(
                info.sessionId,
                info.outputPath,
                publicUrl,
                info.violationType != null ? info.violationType : "UNKNOWN",
                info.startTime,
                (int) (System.currentTimeMillis() - info.startTime),
                "video/mp4",
                fileSize,
                "PERSON_COUNT",  // Changed from 'ALL' - worker filters by this field
                null  // metadata
        );
        
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE_NAME,
                RabbitMQConfig.VIDEO_ANALYSIS_ROUTING_KEY,
                message
        );
        
        log.info("Video queued for AI analysis: session={}, path={}, url={}", 
                info.sessionId, info.outputPath, publicUrl);
    }
    */
    
    /**
     * Schedule automatic stop after duration
     */
    private void scheduleStop(String egressId, int durationSeconds) {
        new Thread(() -> {
            try {
                Thread.sleep(durationSeconds * 1000L);
                if (activeEgress.containsKey(egressId)) {
                    stopRecording(egressId);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }).start();
    }
    
    /**
     * Create LiveKit Egress client
     */
    private EgressServiceClient createEgressClient() {
        // Convert ws:// to http:// for API calls
        String httpHost = livekitHost
                .replace("ws://", "http://")
                .replace("wss://", "https://");
        
        return EgressServiceClient.createClient(httpHost, apiKey, apiSecret);
    }
    
    /**
     * List active recordings
     */
    public Map<String, EgressInfo> getActiveRecordings() {
        return Map.copyOf(activeEgress);
    }
    
    /**
     * Internal class to track egress info
     */
    public static class EgressInfo {
        public final String egressId;
        public final String roomName;
        public final UUID sessionId;
        public final String outputPath;
        public final long startTime;
        private String violationType;
        
        public EgressInfo(String egressId, String roomName, UUID sessionId, 
                         String outputPath, long startTime) {
            this.egressId = egressId;
            this.roomName = roomName;
            this.sessionId = sessionId;
            this.outputPath = outputPath;
            this.startTime = startTime;
        }
        
        public void setViolationType(String violationType) {
            this.violationType = violationType;
        }
        
        public String getViolationType() {
            return violationType;
        }
    }
}

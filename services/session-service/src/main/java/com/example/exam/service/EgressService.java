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
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

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
    
    @net.devh.boot.grpc.client.inject.GrpcClient("incident-service")
    private com.examplatform.incident.grpc.IncidentGrpcServiceGrpc.IncidentGrpcServiceBlockingStub incidentGrpcServiceStub;
    
    // Track active egress sessions
    private final Map<String, EgressInfo> activeEgress = new ConcurrentHashMap<>();
    
    @Value("${incident-service.url:http://incident-service:8082}")
    private String incidentServiceUrl;

    private EgressServiceClient egressClient;
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(8);
    
    public EgressService(RabbitTemplate rabbitTemplate, RestTemplateBuilder restTemplateBuilder) {
        this.rabbitTemplate = rabbitTemplate;
        this.restTemplate = restTemplateBuilder.build();
    }

    @PostConstruct
    public void init() {
        String httpHost = livekitHost
                .replace("ws://", "http://")
                .replace("wss://", "https://");
        this.egressClient = EgressServiceClient.createClient(httpHost, apiKey, apiSecret);
        log.info("Singleton LiveKit EgressServiceClient initialized successfully with host: {}", httpHost);
    }

    @PreDestroy
    public void shutdown() {
        log.info("Shutting down EgressService scheduled executor pool...");
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        log.info("EgressService scheduled executor pool shutdown successfully.");
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
            EgressServiceClient egressClient = this.egressClient;
            
            String outputPath = String.format("sessions/%s/clips/room_%d.mp4", 
                    sessionId, System.currentTimeMillis());
            
            LivekitEgress.S3Upload s3Upload = LivekitEgress.S3Upload.newBuilder()
                    .setEndpoint(minioEndpoint)
                    .setAccessKey(minioAccessKey)
                    .setSecret(minioSecretKey)
                    .setBucket(evidenceBucket)
                    .setRegion("us-east-1")
                    .setForcePathStyle(true)
                    .build();
            
            LivekitEgress.EncodedFileOutput fileOutput = LivekitEgress.EncodedFileOutput.newBuilder()
                    .setFileType(LivekitEgress.EncodedFileType.MP4)
                    .setFilepath(outputPath)
                    .setS3(s3Upload)
                    .build();
            
            LivekitEgress.EgressInfo egressInfo = egressClient.startRoomCompositeEgress(roomName, fileOutput).execute().body();
            
            if (egressInfo == null) {
                log.error("Failed to start room recording: room={} - room may not exist or no participants", roomName);
                throw new RuntimeException("Room does not exist or has no participants. Ensure candidate has joined before recording.");
            }
            
            String egressId = egressInfo.getEgressId();
            
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
            EgressServiceClient egressClient = this.egressClient;
            
            String outputPath = String.format("sessions/%s/clips/%s_%d.mp4", 
                    sessionId, violationType.toLowerCase(), System.currentTimeMillis());
            
            LivekitEgress.S3Upload s3Upload = LivekitEgress.S3Upload.newBuilder()
                    .setEndpoint(minioEndpoint)
                    .setAccessKey(minioAccessKey)
                    .setSecret(minioSecretKey)
                    .setBucket(evidenceBucket)
                    .setRegion("us-east-1")
                    .setForcePathStyle(true)
                    .build();
            
            LivekitEgress.DirectFileOutput fileOutput = LivekitEgress.DirectFileOutput.newBuilder()
                    .setFilepath(outputPath)
                    .setS3(s3Upload)
                    .build();
            
            LivekitEgress.EgressInfo egressInfo = egressClient.startTrackEgress(roomName, fileOutput, trackId).execute().body();
            
            if (egressInfo == null) {
                log.error("Failed to start track recording: room={}, track={} - room/track may not exist", roomName, trackId);
                throw new RuntimeException("Room or track does not exist. Ensure candidate has joined and is publishing video.");
            }
            
            String egressId = egressInfo.getEgressId();
            
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
            EgressServiceClient egressClient = this.egressClient;
            LivekitEgress.EgressInfo result = egressClient.stopEgress(egressId).execute().body();
            
            log.info("Recording stopped: egressId={}, status={}", egressId, result.getStatus());
            
            handleEgressComplete(egressId, result);
            
        } catch (Exception e) {
            log.error("Failed to stop recording: egressId={}, error={}", egressId, e.getMessage(), e);
        }
    }
    
    /**
     * Handle egress completion 
     */
    public void handleEgressComplete(String egressId, LivekitEgress.EgressInfo egressInfo) {
        EgressInfo info = activeEgress.remove(egressId);
        if (info == null) {
            log.warn("Unknown egress completed: {}", egressId);
            return;
        }
        
        log.info("Egress completed: egressId={}, session={}, status={}", 
                egressId, info.sessionId, egressInfo.getStatus());
        
        if (egressInfo.getStatus() == LivekitEgress.EgressStatus.EGRESS_COMPLETE ||
            egressInfo.getStatus() == LivekitEgress.EgressStatus.EGRESS_ENDING) {
            String publicUrl = String.format("%s/%s/%s", 
                    minioExternalEndpoint,
                    evidenceBucket, 
                    info.outputPath);
            String objectKey = String.format("%s/%s", evidenceBucket, info.outputPath);
            
            log.info("Egress video ready: url={}, objectKey={}", publicUrl, objectKey);
            
            sendEgressCompletedEvent(info, publicUrl, objectKey, 0L);
            
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
     * @param fileUrl The S3/MinIO URL of the recorded file 
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
            String publicUrl;
            if (fileUrl != null && !fileUrl.isEmpty()) {
                publicUrl = fileUrl
                        .replace("http://minio:9000", minioExternalEndpoint)
                        .replace("minio:9000", minioExternalEndpoint.replace("http://", ""));
            } else {
                publicUrl = String.format("%s/%s/%s", 
                        minioExternalEndpoint,
                        evidenceBucket, 
                        info.outputPath);
            }
            
            String objectKey = String.format("%s/%s", evidenceBucket, info.outputPath);
            
            log.info("Egress video ready: url={}, objectKey={}, size={}", publicUrl, objectKey, fileSize);
            
            sendEgressCompletedEvent(info, publicUrl, objectKey, fileSize);
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
            log.info("Egress video completed - preparing to send to incident service via gRPC");
            log.info("Video Evidence Details:");
            log.info("Session ID: {}", info.sessionId);
            log.info("Violation Type: {}", info.violationType != null ? info.violationType : "UNKNOWN");
            log.info("Public URL: {}", publicUrl);
            log.info("Object Key: {}", objectKey);
            log.info("File Size: {} bytes", fileSize);
            log.info("Video Format: {}", objectKey.contains(".mp4") ? "MP4" : objectKey.contains(".webm") ? "WebM" : "Unknown");
            
            // Build gRPC request
            com.examplatform.incident.grpc.ClientEventGrpcRequest grpcRequest = com.examplatform.incident.grpc.ClientEventGrpcRequest.newBuilder()
                    .setSessionId(info.sessionId.toString())
                    .setEventType("EVIDENCE_CLIP")
                    .setViolationType(info.violationType != null ? info.violationType : "UNKNOWN")
                    .setViolationState("ESCALATED")
                    .setEvidenceUrl(publicUrl)
                    .setObjectKey(objectKey)
                    .setFileSize(fileSize)
                    .setTimestamp(info.startTime)
                    .setSource("EGRESS_RECORDING")
                    .build();
            
            com.examplatform.incident.grpc.ClientEventGrpcResponse grpcResponse = incidentGrpcServiceStub.sendClientEvent(grpcRequest);
            
            if (grpcResponse.getSuccess()) {
                log.info("Egress video evidence sent successfully to incident service via gRPC: {}", grpcResponse.getMessage());
                log.info("Incident will be created with video objectKey: {}", objectKey);
            } else {
                log.warn("Failed to send egress completed event via gRPC: {}", grpcResponse.getMessage());
            }
        } catch (Exception e) {
            log.error("Failed to send egress completed event to incident service via gRPC: session={}, error={}", 
                    info.sessionId, e.getMessage(), e);
        }
    }
    
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
        scheduler.schedule(() -> {
            if (activeEgress.containsKey(egressId)) {
                stopRecording(egressId);
            }
        }, durationSeconds, TimeUnit.SECONDS);
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

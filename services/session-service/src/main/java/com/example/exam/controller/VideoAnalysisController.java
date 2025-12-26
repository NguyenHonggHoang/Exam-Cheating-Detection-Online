package com.example.exam.controller;

import com.example.exam.config.RabbitMQConfig;
import com.example.exam.dto.VideoAnalysisMessage;
import com.example.exam.dto.VideoAnalysisRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller for video analysis requests
 * 
 * Flow:
 * 1. Frontend TF.js detects violation
 * 2. Frontend uploads clip to MinIO
 * 3. Frontend calls this API with clip info
 * 4. This controller publishes message to video.analysis queue
 * 5. Python AI worker consumes and processes with YOLO
 * 
 * @deprecated As of 2025-12-26, video analysis is handled automatically by worker.
 * Direct API calls are no longer needed. This will be removed in a future version.
 */
@Deprecated
@RestController
@RequestMapping("/api/analysis")
@Tag(name = "Video Analysis", description = "Queue video clips for Python AI analysis")
public class VideoAnalysisController {
    
    private static final Logger log = LoggerFactory.getLogger(VideoAnalysisController.class);
    
    private final RabbitTemplate rabbitTemplate;
    
    public VideoAnalysisController(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }
    
    /**
     * Queue a video clip for AI analysis
     * 
     * Called by frontend after uploading clip to MinIO
     * Python worker will analyze for headphones, phones, objects
     */
    @PostMapping("/video")
    @Operation(summary = "Queue video for AI analysis",
               description = "Submit video clip for YOLO-based detection (headphones, phones, objects)")
    public ResponseEntity<Map<String, Object>> queueVideoAnalysis(
            @Valid @RequestBody VideoAnalysisRequest request) {
        
        log.info("Queueing video analysis: sessionId={}, violation={}, objectKey={}",
                request.getSessionId(), request.getViolationType(), request.getObjectKey());
        
        // Create message for Python worker
        VideoAnalysisMessage message = new VideoAnalysisMessage(
                request.getSessionId(),
                request.getObjectKey(),
                request.getPublicUrl(),
                request.getViolationType(),
                request.getTimestamp(),
                request.getDurationMs() != null ? request.getDurationMs() : 5000,
                request.getMimeType() != null ? request.getMimeType() : "video/webm",
                request.getFileSize() != null ? request.getFileSize() : 0,
                request.getRequestedAnalysis() != null ? request.getRequestedAnalysis() : "ALL",
                request.getMetadata()  // Pass metadata for specialized analysis
        );
        
        // Publish to RabbitMQ
        try {
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.EXCHANGE_NAME,
                    RabbitMQConfig.VIDEO_ANALYSIS_ROUTING_KEY,
                    message
            );
            
            log.info("Video analysis queued successfully: sessionId={}", request.getSessionId());
            
            return ResponseEntity.accepted().body(Map.of(
                    "status", "queued",
                    "message", "Video queued for AI analysis",
                    "sessionId", request.getSessionId().toString(),
                    "objectKey", request.getObjectKey()
            ));
            
        } catch (Exception e) {
            log.error("Failed to queue video analysis: sessionId={}, error={}",
                    request.getSessionId(), e.getMessage(), e);
            
            return ResponseEntity.internalServerError().body(Map.of(
                    "status", "error",
                    "message", "Failed to queue video for analysis: " + e.getMessage()
            ));
        }
    }
    
    /**
     * Health check for video analysis service
     */
    @GetMapping("/health")
    @Operation(summary = "Health check for video analysis queue")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "healthy",
                "queue", RabbitMQConfig.VIDEO_ANALYSIS_QUEUE
        ));
    }
}

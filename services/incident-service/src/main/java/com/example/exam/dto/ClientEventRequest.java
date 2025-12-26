package com.example.exam.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Client Event Request from Frontend AI Detection
 * 
 * Sent to Incident Service when violation detected
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ClientEventRequest {
    // Session info
    private UUID sessionId;
    
    // Event type
    private String eventType;        // "EVIDENCE_SNAPSHOT" or "EVIDENCE_CLIP"
    private String violationType;    // "MULTIPLE_FACES", "LOOKING_AWAY", etc.
    private String violationState;   // "OK", "WARN", "SUSPICIOUS", "ESCALATED"
    
    // Evidence info
    private String evidenceUrl;      // Public URL from MinIO
    private String objectKey;        // Object key in MinIO bucket
    private Long fileSize;           // File size in bytes
    private Long timestamp;          // Event timestamp
    
    // Source
    private String source;           // "FRONTEND_AI" to mark client-side detection
    
    // Additional context (optional)
    private DetectionResultDto detectionResult;
    private Integer consecutiveCount;
    private Long firstDetectedAt;
}

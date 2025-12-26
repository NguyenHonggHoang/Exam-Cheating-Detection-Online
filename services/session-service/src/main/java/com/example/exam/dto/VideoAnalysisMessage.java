package com.example.exam.dto;

import java.util.Map;
import java.util.UUID;

/**
 * DTO for video analysis request
 * Sent to Python AI worker via RabbitMQ
 */
public record VideoAnalysisMessage(
    UUID sessionId,
    String objectKey,       // MinIO key for video file
    String publicUrl,       // Public URL for video
    String violationType,   // Initial violation type from TF.js (MULTIPLE_FACES, PHONE_USAGE, etc.)
    long timestamp,         // When video was captured
    int durationMs,         // Video duration in milliseconds
    String mimeType,        // video/webm or video/mp4
    long fileSize,          // File size in bytes
    String requestedAnalysis, // What to analyze: "ALL", "HEADPHONE", "PHONE", "OBJECT", "SCREEN_GLOW"
    Map<String, Object> metadata // Additional metadata for specialized analysis
) {
    public static VideoAnalysisMessage create(
            UUID sessionId,
            String objectKey,
            String publicUrl,
            String violationType,
            long timestamp,
            int durationMs,
            String mimeType,
            long fileSize) {
        return new VideoAnalysisMessage(
                sessionId, objectKey, publicUrl, violationType,
                timestamp, durationMs, mimeType, fileSize, "ALL", null
        );
    }
}

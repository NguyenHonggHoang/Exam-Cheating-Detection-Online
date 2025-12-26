package com.example.exam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Map;
import java.util.UUID;

/**
 * Request DTO for video clip upload for AI analysis
 */
public class VideoAnalysisRequest {
    
    @NotNull(message = "Session ID is required")
    public UUID sessionId;
    
    @NotBlank(message = "Object key is required")
    public String objectKey;
    
    @NotBlank(message = "Public URL is required")
    public String publicUrl;
    
    @NotBlank(message = "Violation type is required")
    public String violationType;
    
    @NotNull(message = "Timestamp is required")
    public Long timestamp;
    
    public Integer durationMs = 5000;  // Default 5 seconds
    
    public String mimeType = "video/webm";
    
    public Long fileSize;
    
    public String requestedAnalysis = "ALL";  // ALL, HEADPHONE, PHONE, OBJECT, SCREEN_GLOW
    
    public Map<String, Object> metadata;  // Additional metadata for specialized analysis
    
    // Getters and setters
    public UUID getSessionId() { return sessionId; }
    public void setSessionId(UUID sessionId) { this.sessionId = sessionId; }
    
    public String getObjectKey() { return objectKey; }
    public void setObjectKey(String objectKey) { this.objectKey = objectKey; }
    
    public String getPublicUrl() { return publicUrl; }
    public void setPublicUrl(String publicUrl) { this.publicUrl = publicUrl; }
    
    public String getViolationType() { return violationType; }
    public void setViolationType(String violationType) { this.violationType = violationType; }
    
    public Long getTimestamp() { return timestamp; }
    public void setTimestamp(Long timestamp) { this.timestamp = timestamp; }
    
    public Integer getDurationMs() { return durationMs; }
    public void setDurationMs(Integer durationMs) { this.durationMs = durationMs; }
    
    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }
    
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    
    public String getRequestedAnalysis() { return requestedAnalysis; }
    public void setRequestedAnalysis(String requestedAnalysis) { this.requestedAnalysis = requestedAnalysis; }
    
    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }
}

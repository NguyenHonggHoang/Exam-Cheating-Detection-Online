package com.example.exam.dto;

import com.example.exam.model.Incident;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Incident DTOs
 */
public class IncidentDto {

    /**
     * Basic incident response
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private UUID id;
        private UUID sessionId;
        private String examId;  // Added for SSE filtering
        private String type;
        private String severity;
        private String status;
        private String evidenceUrl;
        private String objectKey; // Added objectKey
        private String detectedBy;
        private Instant detectedAt;
        private Instant reviewedAt;
        private String reviewedBy;

        public static Response from(Incident incident) {
            // Build proxy URL instead of using stored presigned URL
            String proxyEvidenceUrl = incident.getObjectKey() != null 
                ? "/api/proxy/incidents/" + incident.getId() + "/evidence"
                : null;
            
            return Response.builder()
                .id(incident.getId())
                .sessionId(incident.getSessionId())
                .type(incident.getType())
                .severity(incident.getSeverity())
                .status(incident.getStatus())
                .evidenceUrl(proxyEvidenceUrl)
                .objectKey(incident.getObjectKey()) // Map objectKey
                .detectedBy(incident.getDetectedBy())
                .detectedAt(incident.getDetectedAt())
                .reviewedAt(incident.getReviewedAt())
                .reviewedBy(incident.getReviewedBy())
                .build();
        }
    }

    /**
     * Detailed incident response with session context
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DetailedResponse {
        private UUID id;
        private UUID sessionId;
        private String examId;           // From shadow table
        private String userId;           // From shadow table
        private String sessionStatus;    // From shadow table
        private String type;
        private String severity;
        private String status;
        private String evidenceUrl;
        private String objectKey;
        private Long fileSize;
        private String detectedBy;
        private Instant detectedAt;
        private Instant reviewedAt;
        private String reviewedBy;
        private Integer consecutiveCount;
        private Instant firstDetectedAt;

        public static DetailedResponse from(Incident incident) {
            // Build proxy URL instead of using stored presigned URL
            String proxyEvidenceUrl = incident.getObjectKey() != null 
                ? "/api/proxy/incidents/" + incident.getId() + "/evidence"
                : null;
            
            return DetailedResponse.builder()
                .id(incident.getId())
                .sessionId(incident.getSessionId())
                .type(incident.getType())
                .severity(incident.getSeverity())
                .status(incident.getStatus())
                .evidenceUrl(proxyEvidenceUrl)
                .objectKey(incident.getObjectKey())
                .fileSize(incident.getFileSize())
                .detectedBy(incident.getDetectedBy())
                .detectedAt(incident.getDetectedAt())
                .reviewedAt(incident.getReviewedAt())
                .reviewedBy(incident.getReviewedBy())
                .consecutiveCount(incident.getConsecutiveCount())
                .firstDetectedAt(incident.getFirstDetectedAt())
                .build();
        }

        // Setters for shadow data
        public void setExamId(String examId) {
            this.examId = examId;
        }

        public void setUserId(String userId) {
            this.userId = userId;
        }

        public void setSessionStatus(String sessionStatus) {
            this.sessionStatus = sessionStatus;
        }
    }

    /**
     * Update status request
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateStatusRequest {
        private String status;
        private String notes;
    }

    /**
     * Summary statistics response
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SummaryResponse {
        private Long totalIncidents;
        private Long pendingIncidents;
        private Long reviewedIncidents;
        private Long dismissedIncidents;
        private Long lowSeverityCount;
        private Long mediumSeverityCount;
        private Long highSeverityCount;
    }
}

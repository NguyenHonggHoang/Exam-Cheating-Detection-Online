package com.example.exam.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BehaviorAnalysisRequest {
    
    private String sessionId;
    private Float overallScore;
    private List<AnomalyDto> anomalies;
    private StatisticsDto statistics;
    private PatternsDto patterns;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AnomalyDto {
        private String type;  // RAPID_ANSWER, EXCESSIVE_REVISION, SUSPICIOUS_PATTERN, TYPING_SPEED_ANOMALY
        private String severity;  // low, medium, high
        private Integer score;
        private String description;
        private Object evidence;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StatisticsDto {
        private Double averageTimePerQuestion;
        private Double averageRevisions;
        private Integer rapidAnswers;
        private Integer slowAnswers;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PatternsDto {
        private Integer preSuspicionCount;
        private Integer timeClusterAnomalies;
    }
}

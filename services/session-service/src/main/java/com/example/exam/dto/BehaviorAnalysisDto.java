package com.example.exam.dto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * DTOs for Answer Behavior Analysis
 * 
 * Mirrors frontend AnswerBehaviorAnalyzer logic for server-side analysis.
 */
public class BehaviorAnalysisDto {

    /**
     * Behavior anomaly detected during analysis
     */
    public record BehaviorAnomaly(
            String type,       // latency_spike, accuracy_jump, revision_pattern, difficulty_mismatch, suspicious_timing
            String severity,   // low, medium, high
            int score,         // 0-100
            String description,
            AnomalyEvidence evidence
    ) {}

    /**
     * Evidence for an anomaly
     */
    public record AnomalyEvidence(
            int questionIndex,
            Object expected,
            Object actual
    ) {}

    /**
     * Answer statistics
     */
    public record AnswerStatistics(
            int totalQuestions,
            int answered,
            int correct,
            double accuracy,
            Map<String, Double> avgTimePerDifficulty,
            Map<String, Double> avgRevisionsPerDifficulty
    ) {}

    /**
     * Behavior pattern detected
     */
    public record BehaviorPattern(
            String name,
            boolean detected,
            double confidence,
            String description
    ) {}

    /**
     * Complete behavior analysis result
     */
    public record BehaviorAnalysisResult(
            int overallScore,  // 0-100 (higher = more suspicious)
            List<BehaviorAnomaly> anomalies,
            AnswerStatistics statistics,
            List<BehaviorPattern> patterns
    ) {}

    /**
     * Request from frontend to submit behavior analysis
     */
    public record FrontendAnalysisRequest(
            UUID sessionId,
            int overallScore,
            List<BehaviorAnomaly> anomalies,
            AnswerStatistics statistics,
            List<BehaviorPattern> patterns
    ) {}

    /**
     * Response after processing behavior analysis
     */
    public record AnalysisResponse(
            UUID sessionId,
            boolean incidentCreated,
            String message
    ) {}
}

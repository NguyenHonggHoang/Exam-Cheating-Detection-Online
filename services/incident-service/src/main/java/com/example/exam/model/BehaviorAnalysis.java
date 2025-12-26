package com.example.exam.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * BehaviorAnalysis Entity - Incident Service
 * 
 * Stores comprehensive behavior analysis results from answer pattern detection.
 * Includes risk score, anomalies, statistics, and patterns.
 */
@Entity
@Table(
    name = "behavior_analyses",
    indexes = {
        @Index(name = "idx_behavior_session_id", columnList = "session_id"),
        @Index(name = "idx_behavior_exam_id", columnList = "exam_id"),
        @Index(name = "idx_behavior_overall_score", columnList = "overall_score")
    }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BehaviorAnalysis {
    
    @Id
    @Column(name = "id", nullable = false)
    private UUID id;
    
    @Column(name = "session_id", nullable = false)
    private UUID sessionId;
    
    @Column(name = "exam_id", nullable = false)
    private UUID examId;
    
    @Column(name = "overall_score")
    private Float overallScore;  // 0-100 risk score
    
    @Column(name = "anomalies_json", columnDefinition = "TEXT")
    private String anomaliesJson;  // JSON array of detected anomalies
    
    @Column(name = "statistics_json", columnDefinition = "TEXT")
    private String statisticsJson;  // JSON object with stats
    
    @Column(name = "patterns_json", columnDefinition = "TEXT")
    private String patternsJson;  // JSON object with pattern analysis
    
    @Column(name = "analyzed_at", nullable = false)
    private Instant analyzedAt = Instant.now();
}

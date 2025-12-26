package com.example.exam.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * AnswerLog Entity - Session Service
 *
 * Stores detailed behavior metrics for each answer submitted during an exam.
 * Used for post-exam analysis and detecting suspicious answer patterns.
 */
@Entity
@Table(
    name = "answer_logs",
    indexes = {
        @Index(name = "idx_answer_session_id", columnList = "session_id"),
        @Index(name = "idx_answer_exam_id", columnList = "exam_id"),
        @Index(name = "idx_answer_question_id", columnList = "question_id")
    }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AnswerLog {
    
    @Id
    @Column(name = "id", nullable = false)
    private UUID id;
    
    @Column(name = "session_id", nullable = false)
    private UUID sessionId;
    
    @Column(name = "exam_id", nullable = false)
    private UUID examId;
    
    @Column(name = "question_id", nullable = false, length = 255)
    private String questionId;
    
    @Column(name = "question_index", nullable = false)
    private Integer questionIndex;
    
    @Column(name = "selected_answer", columnDefinition = "TEXT")
    private String selectedAnswer;
    
    @Column(name = "difficulty", length = 20)
    private String difficulty;  // easy, medium, hard
    
    // Behavior metrics
    @Column(name = "time_to_answer_ms")
    private Integer timeToAnswerMs;
    
    @Column(name = "revision_count")
    private Integer revisionCount;
    
    @Column(name = "answer_changes_json", columnDefinition = "TEXT")
    private String answerChangesJson;  // JSON array of answer changes
    
    @Column(name = "average_typing_speed")
    private Float averageTypingSpeed;
    
    @Column(name = "had_pre_suspicion_during")
    private Boolean hadPreSuspicionDuring;
    
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}

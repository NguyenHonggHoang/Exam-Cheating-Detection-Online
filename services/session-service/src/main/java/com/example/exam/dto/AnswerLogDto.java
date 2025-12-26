package com.example.exam.dto;

import com.example.exam.entity.AnswerLog;

import java.time.Instant;
import java.util.UUID;

/**
 * DTO for AnswerLog entity
 * 
 * Used to transfer answer log data to frontend for proctor dashboard.
 * Contains all behavior metrics for each answer submitted during an exam.
 */
public record AnswerLogDto(
    UUID id,
    UUID sessionId,
    UUID examId,
    String questionId,
    Integer questionIndex,
    String selectedAnswer,
    String difficulty,
    Integer timeToAnswerMs,
    Integer revisionCount,
    String answerChangesJson,
    Float averageTypingSpeed,
    Boolean hadPreSuspicionDuring,
    Instant createdAt
) {
    /**
     * Factory method to create DTO from entity
     */
    public static AnswerLogDto from(AnswerLog entity) {
        return new AnswerLogDto(
            entity.getId(),
            entity.getSessionId(),
            entity.getExamId(),
            entity.getQuestionId(),
            entity.getQuestionIndex(),
            entity.getSelectedAnswer(),
            entity.getDifficulty(),
            entity.getTimeToAnswerMs(),
            entity.getRevisionCount(),
            entity.getAnswerChangesJson(),
            entity.getAverageTypingSpeed(),
            entity.getHadPreSuspicionDuring(),
            entity.getCreatedAt()
        );
    }
}

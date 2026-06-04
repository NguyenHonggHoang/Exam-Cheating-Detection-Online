package com.example.exam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class MockExamDto {

    public record StartSessionRequest(
            @NotNull(message = "examId is required")
            UUID examId,
            
            @NotNull(message = "userId is required")
            String userId
    ) {}

    public record StartSessionResponse(
            UUID sessionId,
            UUID examId,
            String examName,
            int durationMinutes,
            Instant startedAt
    ) {}

    public record Question(
            String id,
            String type, // "MULTIPLE_CHOICE" or "TEXT"
            String text,
            List<String> options, // null for TEXT type
            String correctAnswer, // for demo purposes (shouldn't be sent to frontend in real app)
            String difficulty // EASY, MEDIUM, HARD
    ) {}

    public record GetQuestionsResponse(
            UUID examId,
            String examName,
            List<Question> questions,
            int durationMinutes
    ) {}

    /**
     * Paginated question response.
     * Returned by {@code GET /mock/exams/{examId}/questions?page=0&size=20}.
     */
    public record GetQuestionsPagedResponse(
            UUID examId,
            String examName,
            List<Question> questions,
            int durationMinutes,
            int currentPage,
            int pageSize,
            long totalElements,
            int totalPages,
            boolean hasNext
    ) {}

    public record GetQuestionResponse(
            UUID examId,
            String examName,
            Question question,
            int questionIndex, // 0-based
            int totalQuestions,
            int durationMinutes
    ) {}

    public record SubmitAnswer(
            @NotBlank(message = "questionId is required")
            String questionId,
            
            @NotBlank(message = "answer is required")
            String answer,
            
            // Answer behavior metrics (optional)
            Long timeSpentMs,
            Integer revisionCount,
            List<AnswerChangeDto> answerChanges,
            Double averageTypingSpeed,
            Boolean hadPreSuspicionDuring,
            String difficulty
    ) {}
    
    public record AnswerChangeDto(
            String fromAnswer,
            String toAnswer,
            Long timestamp,
            String reason
    ) {}

    public record SubmitRequest(
            @NotNull(message = "sessionId is required")
            UUID sessionId,
            
            @NotNull(message = "answers is required")
            List<SubmitAnswer> answers
    ) {}

    public record SubmitResponse(
            UUID sessionId,
            Instant submittedAt,
            int totalQuestions,
            int answeredQuestions,
            String message
    ) {}
}

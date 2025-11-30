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
            String correctAnswer // for demo purposes (shouldn't be sent to frontend in real app)
    ) {}

    public record GetQuestionsResponse(
            UUID examId,
            String examName,
            List<Question> questions,
            int durationMinutes
    ) {}

    public record SubmitAnswer(
            @NotBlank(message = "questionId is required")
            String questionId,
            
            @NotBlank(message = "answer is required")
            String answer
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

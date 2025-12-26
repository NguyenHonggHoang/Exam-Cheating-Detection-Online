package com.example.exam.dto;

import com.example.exam.model.ExamSessionState.GeneratedQuestion;

import java.time.Instant;
import java.util.List;

/**
 * DTOs for Secure Exam endpoints.
 */
public class SecureQuestionDto {

    /**
     * Response when starting a secure exam.
     * Does NOT include questions - only metadata.
     */
    public record ExamStartResponse(
            String sessionId,
            String examId,
            String examName,
            int totalQuestions,
            int totalDurationMinutes,
            boolean allowBacktracking,
            int idleTimeoutSeconds
    ) {}

    /**
     * Current question response.
     * NEVER includes correct answer!
     */
    public record CurrentQuestionResponse(
            int questionIndex,
            int totalQuestions,
            String text,
            String type,
            List<String> options,
            int timeLimitSeconds,
            long startedAtEpochMs,
            int remainingSeconds,
            String difficulty
    ) {
        public static CurrentQuestionResponse from(
                GeneratedQuestion q,
                int totalQuestions,
                Instant startedAt
        ) {
            long startedAtMs = startedAt != null ? startedAt.toEpochMilli() : System.currentTimeMillis();
            int elapsed = (int) ((System.currentTimeMillis() - startedAtMs) / 1000);
            int remaining = Math.max(0, q.getTimeLimitSeconds() - elapsed);

            return new CurrentQuestionResponse(
                    q.getQuestionIndex(),
                    totalQuestions,
                    q.getGeneratedText(),
                    q.getType(),
                    q.getGeneratedOptions(),
                    q.getTimeLimitSeconds(),
                    startedAtMs,
                    remaining,
                    q.getDifficulty()
            );
        }
    }

    /**
     * Request to submit an answer.
     */
    public record SubmitAnswerRequest(
            String answer,
            long clientTimeMs
    ) {}

    /**
     * Response after submitting an answer.
     */
    public record SubmitAnswerResponse(
            boolean accepted,
            boolean isLastQuestion,
            boolean examComplete,
            CurrentQuestionResponse nextQuestion,
            int questionsAnswered,
            int totalQuestions,
            Integer finalScore,
            String message
    ) {
        public static SubmitAnswerResponse nextQuestion(
                CurrentQuestionResponse next,
                int answered,
                int total
        ) {
            return new SubmitAnswerResponse(
                    true,
                    false,
                    false,
                    next,
                    answered,
                    total,
                    null,
                    "Answer submitted"
            );
        }

        public static SubmitAnswerResponse examComplete(
                int answered,
                int total,
                int score
        ) {
            return new SubmitAnswerResponse(
                    true,
                    true,
                    true,
                    null,
                    answered,
                    total,
                    score,
                    "Exam completed"
            );
        }

        public static SubmitAnswerResponse locked(String reason) {
            return new SubmitAnswerResponse(
                    false,
                    false,
                    false,
                    null,
                    0,
                    0,
                    null,
                    "Session locked: " + reason
            );
        }
    }

    /**
     * Heartbeat request for idle detection.
     */
    public record HeartbeatRequest(
            long clientTimeMs
    ) {}

    /**
     * Heartbeat response.
     */
    public record HeartbeatResponse(
            boolean ok,
            boolean isLocked,
            String lockReason,
            int currentQuestionIndex,
            int remainingTimeSeconds
    ) {}

    /**
     * Session status response.
     */
    public record SessionStatusResponse(
            String sessionId,
            int currentQuestionIndex,
            int totalQuestions,
            int questionsAnswered,
            boolean isLocked,
            String lockReason,
            boolean isCompleted,
            Integer finalScore,
            long lastActivityEpochMs
    ) {}
}

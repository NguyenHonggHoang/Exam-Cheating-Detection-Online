package com.example.exam.dto;

import com.example.exam.model.Question;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

// TODO: marker for cleanup test
public class QuestionDto {

    /**
     * Full response for admin (includes correct answer)
     */
    public record Response(
            UUID id,
            UUID examId,
            Integer questionOrder,
            String type,
            String text,
            List<String> options,
            String correctAnswer,
            Integer points,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static Response from(Question q) {
            return new Response(
                    q.getId(),
                    q.getExamId(),
                    q.getQuestionOrder(),
                    q.getType().name(),
                    q.getText(),
                    q.getOptions(),
                    q.getCorrectAnswer(),
                    q.getPoints(),
                    q.getCreatedAt(),
                    q.getUpdatedAt()
            );
        }
    }

    /**
     * Response for students (no correct answer)
     */
    public record StudentResponse(
            String id,
            String type,
            String text,
            List<String> options
    ) {
        public static StudentResponse from(Question q) {
            return new StudentResponse(
                    q.getId().toString(),
                    q.getType().name(),
                    q.getText(),
                    q.getOptions()
            );
        }
    }

    /**
     * Request to create a new question
     */
    public record CreateRequest(
            @NotNull(message = "questionOrder is required")
            Integer questionOrder,

            @NotBlank(message = "type is required")
            String type,

            @NotBlank(message = "text is required")
            String text,

            List<String> options,

            String correctAnswer,

            Integer points
    ) {}

    /**
     * Request to update a question
     */
    public record UpdateRequest(
            Integer questionOrder,
            String type,
            String text,
            List<String> options,
            String correctAnswer,
            Integer points
    ) {}
}

package com.example.exam.dto;

import com.example.exam.model.Review;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Review DTOs
 */
public class ReviewDto {

    /**
     * Create review request
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateRequest {
        @NotBlank(message = "Reviewed by is required")
        private String reviewedBy;

        @NotBlank(message = "Decision is required")
        private String decision;  // VALID, FALSE_POSITIVE, ESCALATED, INCONCLUSIVE

        private String notes;
    }

    /**
     * Update review request
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateRequest {
        private String decision;
        private String notes;
    }

    /**
     * Review response
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private UUID id;
        private UUID incidentId;
        private String reviewedBy;
        private String decision;
        private String notes;
        private Instant reviewedAt;
        private Instant createdAt;

        public static Response from(Review review) {
            return Response.builder()
                .id(review.getId())
                .incidentId(review.getIncidentId())
                .reviewedBy(review.getReviewedBy())
                .decision(review.getDecision())
                .notes(review.getNotes())
                .reviewedAt(review.getReviewedAt())
                .createdAt(review.getCreatedAt())
                .build();
        }
    }
}

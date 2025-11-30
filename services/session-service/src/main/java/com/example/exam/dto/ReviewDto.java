package com.example.exam.dto;

import com.example.exam.model.Review;
import com.example.exam.model.ReviewStatus;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

public class ReviewDto {

    public static class CreateRequest {
        @NotNull
        public UUID incidentId;
        public String reviewerId;
        @NotNull
        public ReviewStatus status;
        public String note;
    }

    public static class Response {
        public UUID id;
        public UUID incidentId;
        public String reviewerId;
        public ReviewStatus status;
        public String note;
        public Instant reviewedAt;

        public static Response from(Review r) {
            Response resp = new Response();
            resp.id = r.getId();
            resp.incidentId = r.getIncidentId();
            resp.reviewerId = r.getReviewerId();
            resp.status = r.getStatus();
            resp.note = r.getNote();
            resp.reviewedAt = r.getReviewedAt();
            return resp;
        }
    }
}

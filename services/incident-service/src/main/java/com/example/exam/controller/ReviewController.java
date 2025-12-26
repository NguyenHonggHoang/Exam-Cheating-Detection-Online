package com.example.exam.controller;

import com.example.exam.dto.ReviewDto;
import com.example.exam.model.Review;
import com.example.exam.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Review Controller - Incident Service
 * 
 * Manages incident reviews by proctors/admins
 * 
 * @deprecated As of 2025-12-26, incident review workflow is not actively used.
 * Review functionality may be handled through main incident management.
 * This will be removed in a future version.
 */
@Deprecated
@RestController
@RequestMapping("/api/incidents/{incidentId}/reviews")
@Tag(name = "Reviews", description = "Incident review endpoints")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:3000"})
public class ReviewController {

    private final ReviewService reviewService;

    /**
     * Create a review for an incident
     */
    @PostMapping
    @Operation(summary = "Create incident review")
    public ResponseEntity<ReviewDto.Response> createReview(
            @PathVariable UUID incidentId,
            @Valid @RequestBody ReviewDto.CreateRequest request
    ) {
        Review review = reviewService.createReview(incidentId, request);
        return ResponseEntity.ok(ReviewDto.Response.from(review));
    }

    /**
     * Get all reviews for an incident
     */
    @GetMapping
    @Operation(summary = "Get reviews for incident")
    public ResponseEntity<List<ReviewDto.Response>> getReviews(@PathVariable UUID incidentId) {
        List<Review> reviews = reviewService.getReviewsForIncident(incidentId);
        return ResponseEntity.ok(
            reviews.stream()
                .map(ReviewDto.Response::from)
                .toList()
        );
    }

    /**
     * Update a review
     */
    @PatchMapping("/{reviewId}")
    @Operation(summary = "Update review")
    public ResponseEntity<ReviewDto.Response> updateReview(
            @PathVariable UUID incidentId,
            @PathVariable UUID reviewId,
            @Valid @RequestBody ReviewDto.UpdateRequest request
    ) {
        Review updated = reviewService.updateReview(reviewId, request);
        return ResponseEntity.ok(ReviewDto.Response.from(updated));
    }
}

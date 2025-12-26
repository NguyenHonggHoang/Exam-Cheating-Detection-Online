package com.example.exam.service;

import com.example.exam.dto.ReviewDto;
import com.example.exam.model.Incident;
import com.example.exam.model.Review;
import com.example.exam.repository.IncidentRepository;
import com.example.exam.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Review Service - Manages incident reviews
 * 
 * @deprecated As of 2025-12-26, review workflow is not actively used.
 * Tied to deprecated ReviewController.
 * This will be removed in a future version.
 */
@Deprecated
@Service
@RequiredArgsConstructor
public class ReviewService {

    private static final Logger log = LoggerFactory.getLogger(ReviewService.class);

    private final ReviewRepository reviewRepository;
    private final IncidentRepository incidentRepository;

    /**
     * Create a review for an incident
     */
    @Transactional
    public Review createReview(UUID incidentId, ReviewDto.CreateRequest request) {
        // Validate incident exists
        Incident incident = incidentRepository.findById(incidentId)
            .orElseThrow(() -> new IllegalArgumentException("Incident not found: " + incidentId));

        // Create review
        Review review = new Review();
        review.setId(UUID.randomUUID());
        review.setIncidentId(incidentId);
        review.setReviewedBy(request.getReviewedBy());
        review.setDecision(request.getDecision());
        review.setNotes(request.getNotes());
        review.setReviewedAt(Instant.now());
        review.setCreatedAt(Instant.now());

        Review saved = reviewRepository.save(review);

        // Update incident status based on review decision
        updateIncidentStatusFromReview(incident, request.getDecision());

        log.info("Review created: incidentId={}, decision={}, reviewedBy={}", 
            incidentId, request.getDecision(), request.getReviewedBy());

        return saved;
    }

    /**
     * Get all reviews for an incident
     */
    @Transactional(readOnly = true)
    public List<Review> getReviewsForIncident(UUID incidentId) {
        return reviewRepository.findByIncidentId(incidentId);
    }

    /**
     * Update a review
     */
    @Transactional
    public Review updateReview(UUID reviewId, ReviewDto.UpdateRequest request) {
        Review review = reviewRepository.findById(reviewId)
            .orElseThrow(() -> new IllegalArgumentException("Review not found: " + reviewId));

        if (request.getDecision() != null) {
            review.setDecision(request.getDecision());
            
            // Update incident status
            incidentRepository.findById(review.getIncidentId()).ifPresent(incident -> {
                updateIncidentStatusFromReview(incident, request.getDecision());
            });
        }

        if (request.getNotes() != null) {
            review.setNotes(request.getNotes());
        }

        return reviewRepository.save(review);
    }

    /**
     * Update incident status based on review decision
     */
    private void updateIncidentStatusFromReview(Incident incident, String decision) {
        switch (decision) {
            case "VALID":
                incident.setStatus("REVIEWED");
                incident.setReviewedAt(Instant.now());
                break;
            case "FALSE_POSITIVE":
                incident.setStatus("DISMISSED");
                incident.setReviewedAt(Instant.now());
                break;
            case "ESCALATED":
                incident.setStatus("ESCALATED");
                break;
            default:
                incident.setStatus("UNDER_REVIEW");
        }

        incidentRepository.save(incident);
    }
}

package com.example.exam.controller;

import com.example.exam.dto.ReviewDto;
import com.example.exam.model.Review;
import com.example.exam.repository.IncidentRepository;
import com.example.exam.repository.ReviewRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/reviews")
@Tag(name = "Reviews")
public class ReviewController {

    private final ReviewRepository reviewRepository;
    private final IncidentRepository incidentRepository;

    public ReviewController(ReviewRepository reviewRepository, IncidentRepository incidentRepository) {
        this.reviewRepository = reviewRepository;
        this.incidentRepository = incidentRepository;
    }

    @PostMapping
    @Operation(summary = "Create review for an incident (ADMIN only)")
    public ResponseEntity<?> create(@Valid @RequestBody ReviewDto.CreateRequest req) {
        // Ensure incident exists
        UUID incidentId = java.util.Objects.requireNonNull(req.incidentId);
        if (!incidentRepository.existsById(incidentId)) {
            return ResponseEntity.notFound().build();
        }
        // Enforce one review per incident
        if (reviewRepository.findByIncidentId(incidentId).isPresent()) {
            return ResponseEntity.status(409).build();
        }

        // Optional reviewerId: if provided, we assume it's valid for now as we don't have local users
        // In a real scenario, we could call user-service to validate
        /*
        if (req.reviewerId != null && !userRepository.existsById(req.reviewerId)) {
            return ResponseEntity.badRequest().body(
                java.util.Map.of(
                    "type", "https://example.com/problems/data-integrity",
                    "title", "Reviewer not found",
                    "status", 400,
                    "detail", "User with reviewerId does not exist"
                )
            );
        }
        */
        Review r = new Review();
        r.setIncidentId(incidentId);
        r.setReviewerId(req.reviewerId);
        r.setStatus(req.status);
        r.setNote(req.note);
        r.setReviewedAt(Instant.now());
        Review saved = reviewRepository.save(r);
        return ResponseEntity.ok(ReviewDto.Response.from(saved));
    }

    @GetMapping
    @Operation(summary = "Get review by incidentId (ADMIN only)")
    public ResponseEntity<ReviewDto.Response> getByIncident(@RequestParam("incidentId") UUID incidentId) {
        Optional<Review> opt = reviewRepository.findByIncidentId(java.util.Objects.requireNonNull(incidentId));
        return opt.map(review -> ResponseEntity.ok(ReviewDto.Response.from(review)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}

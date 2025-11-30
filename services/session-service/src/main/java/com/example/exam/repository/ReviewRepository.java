package com.example.exam.repository;

import com.example.exam.model.Review;
import com.example.exam.model.ReviewStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReviewRepository extends JpaRepository<Review, UUID> {
    Optional<Review> findByIncidentId(UUID incidentId);
    List<Review> findByReviewerIdAndStatus(String reviewerId, ReviewStatus status);
}

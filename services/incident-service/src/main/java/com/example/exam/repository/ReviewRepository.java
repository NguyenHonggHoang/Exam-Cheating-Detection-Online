package com.example.exam.repository;

import com.example.exam.model.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Review Repository
 */
@Repository
public interface ReviewRepository extends JpaRepository<Review, UUID> {
    
    /**
     * Find all reviews for an incident
     */
    List<Review> findByIncidentId(UUID incidentId);
    
    /**
     * Find reviews by reviewer
     */
    List<Review> findByReviewedBy(String reviewedBy);
    
    /**
     * Find reviews by decision type
     */
    List<Review> findByDecision(String decision);
}

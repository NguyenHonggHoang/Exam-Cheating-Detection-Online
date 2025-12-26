package com.example.exam.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Review Entity - Incident Service
 * 
 * Stores proctor/admin reviews of incidents
 */
@Entity
@Table(
    name = "reviews",
    indexes = {
        @Index(name = "idx_review_incident_id", columnList = "incident_id"),
        @Index(name = "idx_review_reviewed_by", columnList = "reviewed_by"),
        @Index(name = "idx_review_decision", columnList = "decision")
    }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Review {
    
    @Id
    @Column(name = "id", nullable = false)
    private UUID id;
    
    @Column(name = "incident_id", nullable = false)
    private UUID incidentId;
    
    @Column(name = "reviewed_by", nullable = false, length = 255)
    private String reviewedBy;  // User ID of reviewer (proctor/admin)
    
    @Column(name = "decision", nullable = false, length = 50)
    private String decision;  // VALID, FALSE_POSITIVE, ESCALATED, INCONCLUSIVE
    
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
    
    @Column(name = "reviewed_at", nullable = false)
    private Instant reviewedAt;
    
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}

package com.example.exam.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Student Shadow Entity - Local cache of user data
 * Synced from User Service via Kafka CDC
 * 
 * Purpose: Fast lookups without HTTP calls to User Service
 * Use Case: Tag incidents with student info
 */
@Entity
@Table(name = "student_shadow")
@Data
@NoArgsConstructor
public class StudentShadowEntity {

    @Id
    @Column(name = "user_id", nullable = false, length = 255)
    private String userId;

    @Column(name = "full_name", length = 255)
    private String fullName;

    @Column(name = "student_code", length = 50)
    private String studentCode;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "synced_at", nullable = false)
    private Instant syncedAt;

    /**
     * Constructor for CDC sync
     */
    public StudentShadowEntity(String userId, String fullName, String studentCode, String email) {
        this.userId = userId;
        this.fullName = fullName;
        this.studentCode = studentCode;
        this.email = email;
        this.syncedAt = Instant.now();
    }

    /**
     * Update fields from CDC event
     */
    public void updateFrom(String fullName, String studentCode, String email) {
        this.fullName = fullName;
        this.studentCode = studentCode;
        this.email = email;
        this.syncedAt = Instant.now();
    }
}

package com.example.exam.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * User Shadow Entity - Local cache of user data from identity_db
 * 
 * Synced via CDC from identity_db.users table
 * This is the ONLY user data in session_db (microservices principle)
 * 
 * Purpose: Eliminate Feign calls to user-service for user lookups
 * Use Case: Display user info in session details, validate user roles
 */
@Entity
@Table(name = "user_shadow")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserShadowEntity {

    @Id
    @Column(name = "user_id", nullable = false, length = 255)
    private String userId;  // OAuth2 subject ID from identity_db

    @Column(name = "username", nullable = false, length = 100)
    private String username;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "role", length = 50)
    private String role;

    @Column(name = "enabled")
    private Boolean enabled = true;

    @Column(name = "deleted", nullable = false)
    private Boolean deleted = false;

    @Column(name = "synced_at", nullable = false)
    private Instant syncedAt = Instant.now();

    /**
     * Update fields from CDC event
     */
    public void updateFrom(String username, String email, String role, Boolean enabled) {
        this.username = username;
        this.email = email;
        this.role = role;
        this.enabled = enabled;
        this.deleted = false; // Undelete if was soft-deleted
        this.syncedAt = Instant.now();
    }

    /**
     * Mark as deleted (soft delete)
     */
    public void markDeleted() {
        this.deleted = true;
        this.syncedAt = Instant.now();
    }
}

package com.example.exam.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * User Shadow Entity - Incident Service
 * 
 * Cached copy of user data from identity_db via CDC
 * Enables local queries without cross-service calls
 */
@Entity
@Table(
    name = "user_shadow",
    indexes = {
        @Index(name = "idx_user_shadow_email", columnList = "email"),
        @Index(name = "idx_user_shadow_student_code", columnList = "student_code"),
        @Index(name = "idx_user_shadow_deleted", columnList = "deleted")
    }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserShadowEntity {
    
    @Id
    @Column(name = "user_id", nullable = false, length = 255)
    private String userId;
    
    @Column(name = "full_name", length = 255)
    private String fullName;
    
    @Column(name = "email", length = 255)
    private String email;
    
    @Column(name = "student_code", length = 100)
    private String studentCode;
    
    @Column(name = "role", length = 50)
    private String role;  // STUDENT, PROCTOR, ADMIN
    
    /**
     * Soft delete support (Debezium delete.handling.mode = rewrite)
     */
    @Column(name = "deleted", nullable = false)
    private Boolean deleted = false;
    
    /**
     * Last sync time from CDC
     */
    @Column(name = "synced_at", nullable = false)
    private Instant syncedAt = Instant.now();
    
    /**
     * Helper: Check if user is active
     */
    public boolean isActive() {
        return !deleted;
    }
}

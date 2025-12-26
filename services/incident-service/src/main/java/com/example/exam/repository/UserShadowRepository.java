package com.example.exam.repository;

import com.example.exam.model.UserShadowEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * User Shadow Repository - Incident Service
 */
@Repository
public interface UserShadowRepository extends JpaRepository<UserShadowEntity, String> {
    
    /**
     * Find active (non-deleted) user by ID
     */
    @Query("SELECT u FROM UserShadowEntity u WHERE u.userId = ?1 AND u.deleted = false")
    Optional<UserShadowEntity> findActiveUser(String userId);
    
    /**
     * Find user by email
     */
    Optional<UserShadowEntity> findByEmailAndDeletedFalse(String email);
    
    /**
     * Find user by student code
     */
    Optional<UserShadowEntity> findByStudentCodeAndDeletedFalse(String studentCode);
    
    /**
     * Find all active students (for reporting)
     */
    @Query("SELECT u FROM UserShadowEntity u WHERE u.role = 'STUDENT' AND u.deleted = false")
    List<UserShadowEntity> findAllActiveStudents();
    
    /**
     * Search users by name (for autocomplete)
     */
    @Query("SELECT u FROM UserShadowEntity u WHERE LOWER(u.fullName) LIKE LOWER(CONCAT('%', ?1, '%')) AND u.deleted = false")
    List<UserShadowEntity> searchByName(String query);
}

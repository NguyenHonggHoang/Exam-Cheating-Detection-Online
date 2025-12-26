package com.example.exam.repository;

import com.example.exam.model.UserShadowEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for User Shadow table
 * 
 * User data is synced from identity_db via CDC
 * This is READ-ONLY from application perspective (updated by CDC consumer)
 */
@Repository
public interface UserShadowRepository extends JpaRepository<UserShadowEntity, String> {

    /**
     * Find user by username (case-insensitive)
     */
    Optional<UserShadowEntity> findByUsernameIgnoreCase(String username);

    /**
     * Find all active (non-deleted) users
     */
    @Query("SELECT u FROM UserShadowEntity u WHERE u.deleted = false")
    List<UserShadowEntity> findAllActive();

    /**
     * Find user by email
     */
    Optional<UserShadowEntity> findByEmail(String email);

    /**
     * Check if user exists and is active
     */
    @Query("SELECT CASE WHEN COUNT(u) > 0 THEN true ELSE false END FROM UserShadowEntity u WHERE u.userId = ?1 AND u.deleted = false")
    boolean existsActiveUser(String userId);
}

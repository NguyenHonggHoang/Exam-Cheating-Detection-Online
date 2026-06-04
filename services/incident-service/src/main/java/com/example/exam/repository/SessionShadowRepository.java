package com.example.exam.repository;

import com.example.exam.model.SessionShadowEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for Session Shadow table
 * 
 * Updated by CDC consumer, queried by incident logic
 */
@Repository
public interface SessionShadowRepository extends JpaRepository<SessionShadowEntity, UUID> {

    /**
     * Find all active sessions for a user
     */
    @Query("SELECT s FROM SessionShadowEntity s WHERE s.userId = ?1 AND s.status = 'ACTIVE' AND s.deleted = false")
    List<SessionShadowEntity> findActiveSessionsByUser(UUID userId);

    /**
     * Find all sessions for an exam
     */
    @Query("SELECT s FROM SessionShadowEntity s WHERE s.examId = ?1 AND s.deleted = false")
    List<SessionShadowEntity> findSessionsByExam(UUID examId);

    /**
     * Find active sessions
     */
    @Query("SELECT s FROM SessionShadowEntity s WHERE s.status = 'ACTIVE' AND s.deleted = false")
    List<SessionShadowEntity> findAllActiveSessions();

    /**
     * Check if session exists and is active
     */
    @Query("SELECT CASE WHEN COUNT(s) > 0 THEN true ELSE false END FROM SessionShadowEntity s WHERE s.sessionId = ?1 AND s.status = 'ACTIVE' AND s.deleted = false")
    boolean isSessionActive(UUID sessionId);

    /**
     * Find all sessions for a user (regardless of status, to see past incidents)
     */
    @Query("SELECT s FROM SessionShadowEntity s WHERE s.userId = ?1 AND s.deleted = false")
    List<SessionShadowEntity> findSessionsByUser(UUID userId);

    /**
     * Check if a session belongs to a user
     */
    @Query("SELECT CASE WHEN COUNT(s) > 0 THEN true ELSE false END FROM SessionShadowEntity s WHERE s.sessionId = ?1 AND s.userId = ?2 AND s.deleted = false")
    boolean isSessionOwnedByUser(UUID sessionId, UUID userId);

    /**
     * Find ended sessions (for cleanup)
     */
    @Query("SELECT s FROM SessionShadowEntity s WHERE s.status IN ('ENDED', 'ABORTED') AND s.deleted = false")
    List<SessionShadowEntity> findEndedSessions();
}

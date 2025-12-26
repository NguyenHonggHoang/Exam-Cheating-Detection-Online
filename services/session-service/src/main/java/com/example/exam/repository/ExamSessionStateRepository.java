package com.example.exam.repository;

import com.example.exam.model.ExamSessionState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExamSessionStateRepository extends JpaRepository<ExamSessionState, UUID> {

    /**
     * Find state by session ID.
     */
    Optional<ExamSessionState> findBySessionId(UUID sessionId);

    /**
     * Check if session has state.
     */
    boolean existsBySessionId(UUID sessionId);

    /**
     * Find all locked sessions.
     */
    List<ExamSessionState> findByIsLockedTrue();

    /**
     * Find all completed sessions.
     */
    List<ExamSessionState> findByIsCompletedTrue();

    /**
     * Find active sessions (not locked, not completed).
     */
    List<ExamSessionState> findByIsLockedFalseAndIsCompletedFalse();

    /**
     * Find sessions idle for more than specified duration.
     */
    @Query("SELECT s FROM ExamSessionState s WHERE s.isLocked = false AND s.isCompleted = false AND s.lastActivityAt < :threshold")
    List<ExamSessionState> findIdleSessions(@Param("threshold") Instant threshold);
}

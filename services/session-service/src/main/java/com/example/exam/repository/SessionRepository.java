package com.example.exam.repository;

import com.example.exam.model.Session;
import com.example.exam.model.SessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, UUID> {
    
    /**
     * Find all sessions for a specific user, ordered by started_at descending
     */
    List<Session> findByUserIdOrderByStartedAtDesc(String userId);
    
    /**
     * Find all sessions for a specific exam
     */
    List<Session> findByExamId(UUID examId);
    
    /**
     * Find all sessions for a specific exam, ordered by started_at descending
     */
    List<Session> findByExamIdOrderByStartedAtDesc(UUID examId);
    
    /**
     * Find sessions by exam and status
     */
    List<Session> findByExamIdAndStatus(UUID examId, SessionStatus status);
    
    /**
     * Find active sessions for an exam
     */
    List<Session> findByExamIdAndStatusOrderByStartedAtDesc(UUID examId, SessionStatus status);
    
    /**
     * Count all sessions for a specific user and exam
     * Used for attempt limit checking
     */
    int countByExamIdAndUserId(UUID examId, String userId);
    
    /**
     * Find sessions for a user and exam with specific status
     * Used to check if user has an active session for this exam
     */
    List<Session> findByExamIdAndUserIdAndStatus(UUID examId, String userId, SessionStatus status);
}


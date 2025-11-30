package com.example.exam.repository;

import com.example.exam.model.Session;
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
}

package com.example.exam.repository;

import com.example.exam.entity.AnswerLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AnswerLogRepository extends JpaRepository<AnswerLog, UUID> {
    List<AnswerLog> findBySessionId(UUID sessionId);
    List<AnswerLog> findByExamId(UUID examId);
    List<AnswerLog> findBySessionIdOrderByQuestionIndex(UUID sessionId);
}

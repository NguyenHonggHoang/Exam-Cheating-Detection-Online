package com.example.exam.repository;

import com.example.exam.model.BehaviorAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BehaviorAnalysisRepository extends JpaRepository<BehaviorAnalysis, UUID> {
    Optional<BehaviorAnalysis> findBySessionId(UUID sessionId);
    List<BehaviorAnalysis> findByExamId(UUID examId);
    List<BehaviorAnalysis> findByOverallScoreGreaterThanEqual(Float threshold);
}

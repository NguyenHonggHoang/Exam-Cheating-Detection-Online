package com.example.exam.repository;

import com.example.exam.model.QuestionTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface QuestionTemplateRepository extends JpaRepository<QuestionTemplate, UUID> {

    /**
     * Find all templates for an exam, ordered by question order.
     */
    List<QuestionTemplate> findByExamIdOrderByQuestionOrder(UUID examId);

    /**
     * Count templates for an exam.
     */
    long countByExamId(UUID examId);

    /**
     * Check if exam has any templates.
     */
    boolean existsByExamId(UUID examId);

    /**
     * Delete all templates for an exam.
     */
    void deleteByExamId(UUID examId);
}

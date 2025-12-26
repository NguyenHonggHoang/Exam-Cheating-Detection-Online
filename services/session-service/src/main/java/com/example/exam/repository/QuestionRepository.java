package com.example.exam.repository;

import com.example.exam.model.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface QuestionRepository extends JpaRepository<Question, UUID> {
    
    /**
     * Find all questions for an exam, ordered by question_order
     */
    List<Question> findByExamIdOrderByQuestionOrder(UUID examId);
    
    /**
     * Count questions for an exam
     */
    int countByExamId(UUID examId);
    
    /**
     * Delete all questions for an exam
     */
    void deleteByExamId(UUID examId);
}

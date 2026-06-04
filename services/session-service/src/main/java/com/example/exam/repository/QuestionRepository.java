package com.example.exam.repository;

import com.example.exam.model.Question;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface QuestionRepository extends JpaRepository<Question, UUID> {

    /**
     * Find all questions for an exam, ordered by question_order.
     * Use for small exams or when the full list is required (e.g., grading).
     */
    List<Question> findByExamIdOrderByQuestionOrder(UUID examId);

    /**
     * Paginated question load for an exam.
     * Preferred when the exam has a large question bank (hundreds+).
     * Example: {@code Pageable pageable = PageRequest.of(page, size);}
     */
    Page<Question> findByExamIdOrderByQuestionOrder(UUID examId, Pageable pageable);

    /**
     * Find all questions for multiple exams (batch IN query).
     * Eliminates N+1 problem when loading questions for many exams at once.
     */
    List<Question> findByExamIdIn(List<UUID> examIds);

    /**
     * Count questions for an exam (avoids loading entities just to get the count).
     */
    int countByExamId(UUID examId);

    /**
     * Delete all questions for an exam.
     */
    void deleteByExamId(UUID examId);
}


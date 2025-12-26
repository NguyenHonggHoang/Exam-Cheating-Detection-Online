package com.example.exam.controller;

import com.example.exam.dto.QuestionDto;
import com.example.exam.model.Question;
import com.example.exam.repository.ExamRepository;
import com.example.exam.repository.QuestionRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * @deprecated As of 2025-12-26, this controller is no longer used.
 * Question management is now handled through MockExamController.
 * This will be removed in a future version.
 */
@Deprecated
@RestController
@RequestMapping("/api/exams/{examId}/questions")
@Tag(name = "Questions", description = "Question management endpoints")
public class QuestionController {

    private final QuestionRepository questionRepository;
    private final ExamRepository examRepository;

    public QuestionController(QuestionRepository questionRepository, ExamRepository examRepository) {
        this.questionRepository = questionRepository;
        this.examRepository = examRepository;
    }

    @GetMapping
    @Operation(summary = "Get all questions for an exam", description = "Retrieve all questions for a specific exam (Admin view with correct answers)")
    public ResponseEntity<List<QuestionDto.Response>> getQuestions(@PathVariable UUID examId) {
        // Verify exam exists
        examRepository.findById(examId)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + examId));
        
        List<Question> questions = questionRepository.findByExamIdOrderByQuestionOrder(examId);
        List<QuestionDto.Response> response = questions.stream()
                .map(QuestionDto.Response::from)
                .toList();
        
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{questionId}")
    @Operation(summary = "Get a question by ID", description = "Retrieve a single question by its ID")
    public ResponseEntity<QuestionDto.Response> getQuestion(
            @PathVariable UUID examId,
            @PathVariable UUID questionId
    ) {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Question not found: " + questionId));
        
        if (!question.getExamId().equals(examId)) {
            throw new IllegalArgumentException("Question does not belong to exam: " + examId);
        }
        
        return ResponseEntity.ok(QuestionDto.Response.from(question));
    }

    @PostMapping
    @Operation(summary = "Create a new question", description = "Add a new question to an exam")
    public ResponseEntity<QuestionDto.Response> createQuestion(
            @PathVariable UUID examId,
            @Valid @RequestBody QuestionDto.CreateRequest request
    ) {
        // Verify exam exists
        examRepository.findById(examId)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + examId));
        
        Question question = new Question();
        question.setExamId(examId);
        question.setQuestionOrder(request.questionOrder());
        question.setType(Question.QuestionType.valueOf(request.type()));
        question.setText(request.text());
        question.setOptions(request.options());
        question.setCorrectAnswer(request.correctAnswer());
        question.setPoints(request.points() != null ? request.points() : 1);
        
        question = questionRepository.save(question);
        
        return ResponseEntity.status(HttpStatus.CREATED).body(QuestionDto.Response.from(question));
    }

    @PutMapping("/{questionId}")
    @Operation(summary = "Update a question", description = "Update an existing question")
    public ResponseEntity<QuestionDto.Response> updateQuestion(
            @PathVariable UUID examId,
            @PathVariable UUID questionId,
            @Valid @RequestBody QuestionDto.UpdateRequest request
    ) {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Question not found: " + questionId));
        
        if (!question.getExamId().equals(examId)) {
            throw new IllegalArgumentException("Question does not belong to exam: " + examId);
        }
        
        // Update fields if provided
        if (request.questionOrder() != null) {
            question.setQuestionOrder(request.questionOrder());
        }
        if (request.type() != null) {
            question.setType(Question.QuestionType.valueOf(request.type()));
        }
        if (request.text() != null) {
            question.setText(request.text());
        }
        if (request.options() != null) {
            question.setOptions(request.options());
        }
        if (request.correctAnswer() != null) {
            question.setCorrectAnswer(request.correctAnswer());
        }
        if (request.points() != null) {
            question.setPoints(request.points());
        }
        
        question = questionRepository.save(question);
        
        return ResponseEntity.ok(QuestionDto.Response.from(question));
    }

    @DeleteMapping("/{questionId}")
    @Operation(summary = "Delete a question", description = "Delete a question by ID")
    public ResponseEntity<Void> deleteQuestion(
            @PathVariable UUID examId,
            @PathVariable UUID questionId
    ) {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Question not found: " + questionId));
        
        if (!question.getExamId().equals(examId)) {
            throw new IllegalArgumentException("Question does not belong to exam: " + examId);
        }
        
        questionRepository.delete(question);
        
        return ResponseEntity.noContent().build();
    }
}

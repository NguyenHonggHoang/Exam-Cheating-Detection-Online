package com.example.exam.controller;

import com.example.exam.dto.ExamDto;
import com.example.exam.service.ExamService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/exams")
@Tag(name = "Exams", description = "Exam management endpoints")
public class ExamController {

    private final ExamService examService;

    public ExamController(ExamService examService) {
        this.examService = examService;
    }

    @GetMapping
    @Operation(summary = "Get all exams", description = "Retrieve all exams, optionally filtered by status (ACTIVE, ENDED, UPCOMING)")
    public ResponseEntity<List<ExamDto.Response>> getAllExams(
            @RequestParam(required = false) String status
    ) {
        List<ExamDto.Response> exams = examService.getAllExams(status);
        return ResponseEntity.ok(exams);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get exam by ID", description = "Retrieve a single exam by its ID")
    public ResponseEntity<ExamDto.Response> getExamById(@PathVariable UUID id) {
        ExamDto.Response exam = examService.getExamById(id);
        return ResponseEntity.ok(exam);
    }

    @PostMapping
    @Operation(summary = "Create new exam", description = "Create a new exam")
    public ResponseEntity<ExamDto.Response> createExam(@Valid @RequestBody ExamDto.CreateRequest request) {
        ExamDto.Response exam = examService.createExam(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(exam);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update exam", description = "Update an existing exam")
    public ResponseEntity<ExamDto.Response> updateExam(
            @PathVariable UUID id,
            @Valid @RequestBody ExamDto.UpdateRequest request
    ) {
        ExamDto.Response exam = examService.updateExam(id, request);
        return ResponseEntity.ok(exam);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete exam", description = "Delete an exam by ID")
    public ResponseEntity<Void> deleteExam(@PathVariable UUID id) {
        examService.deleteExam(id);
        return ResponseEntity.noContent().build();
    }
}

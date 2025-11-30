package com.example.exam.controller;

import com.example.exam.dto.MockExamDto;
import com.example.exam.service.MockExamService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/mock-exam")
@Tag(name = "Mock Exam", description = "Mock exam endpoints for testing")
public class MockExamController {

    private final MockExamService mockExamService;

    public MockExamController(MockExamService mockExamService) {
        this.mockExamService = mockExamService;
    }

    @PostMapping("/start")
    @Operation(summary = "Start exam session", description = "Create a new exam session for a user")
    public ResponseEntity<MockExamDto.StartSessionResponse> startSession(
            @Valid @RequestBody MockExamDto.StartSessionRequest request
    ) {
        MockExamDto.StartSessionResponse response = mockExamService.startSession(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{examId}/questions")
    @Operation(summary = "Get exam questions", description = "Get list of questions for an exam")
    public ResponseEntity<MockExamDto.GetQuestionsResponse> getQuestions(
            @PathVariable UUID examId
    ) {
        MockExamDto.GetQuestionsResponse response = mockExamService.getQuestions(examId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/submit")
    @Operation(summary = "Submit exam", description = "Submit exam answers and end session")
    public ResponseEntity<MockExamDto.SubmitResponse> submitExam(
            @Valid @RequestBody MockExamDto.SubmitRequest request
    ) {
        MockExamDto.SubmitResponse response = mockExamService.submitExam(request);
        return ResponseEntity.ok(response);
    }
}

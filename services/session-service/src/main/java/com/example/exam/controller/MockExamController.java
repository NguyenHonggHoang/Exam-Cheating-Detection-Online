package com.example.exam.controller;

import com.example.exam.dto.BehaviorAnalysisDto;
import com.example.exam.dto.MockExamDto;
import com.example.exam.service.BehaviorAnalyzerService;
import com.example.exam.service.MockExamService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/mock-exam")
@Tag(name = "Mock Exam", description = "Mock exam endpoints for testing")
public class MockExamController {

    private final MockExamService mockExamService;
    private final BehaviorAnalyzerService behaviorAnalyzerService;

    public MockExamController(MockExamService mockExamService, BehaviorAnalyzerService behaviorAnalyzerService) {
        this.mockExamService = mockExamService;
        this.behaviorAnalyzerService = behaviorAnalyzerService;
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
    @Operation(summary = "Get exam questions (full, cached)",
               description = "Get the complete list of questions for an exam. " +
                             "Result is in-memory cached after first load. " +
                             "For large question banks (500+), prefer the paginated endpoint.")
    public ResponseEntity<MockExamDto.GetQuestionsResponse> getQuestions(
            @PathVariable UUID examId
    ) {
        MockExamDto.GetQuestionsResponse response = mockExamService.getQuestions(examId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{examId}/questions/paged")
    @Operation(summary = "Get exam questions (paginated)",
               description = "Paginated question loading. Preferred for exams with large question banks. " +
                             "Reads from the read replica datasource. " +
                             "Query params: page (0-based, default 0), size (default 20, max 200).")
    public ResponseEntity<MockExamDto.GetQuestionsPagedResponse> getQuestionsPaged(
            @PathVariable UUID examId,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        MockExamDto.GetQuestionsPagedResponse response = mockExamService.getQuestionsPaged(examId, page, size);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{examId}/question/{questionIndex}")
    @Operation(summary = "Get single question", description = "Get a single question by index (0-based)")
    public ResponseEntity<MockExamDto.GetQuestionResponse> getQuestion(
            @PathVariable UUID examId,
            @PathVariable int questionIndex
    ) {
        MockExamDto.GetQuestionResponse response = mockExamService.getQuestion(examId, questionIndex);
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

    @PostMapping("/analysis")
    @Operation(summary = "Submit behavior analysis", description = "Submit frontend behavior analysis results")
    public ResponseEntity<BehaviorAnalysisDto.AnalysisResponse> submitBehaviorAnalysis(
            @Valid @RequestBody BehaviorAnalysisDto.FrontendAnalysisRequest request
    ) {
        BehaviorAnalysisDto.AnalysisResponse response = behaviorAnalyzerService.processFrontendAnalysis(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{sessionId}/behavior-analysis")
    @Operation(summary = "Get behavior analysis", description = "Run server-side behavior analysis on session data")
    public ResponseEntity<BehaviorAnalysisDto.BehaviorAnalysisResult> getBehaviorAnalysis(
            @PathVariable UUID sessionId
    ) {
        BehaviorAnalysisDto.BehaviorAnalysisResult result = behaviorAnalyzerService.analyzeSession(sessionId);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/batch/start")
    @Operation(summary = "Start batch exam sessions", description = "Create new exam sessions for a list of students in batch")
    public Mono<ResponseEntity<List<MockExamDto.StartSessionResponse>>> startSessionBatch(
            @Valid @RequestBody List<MockExamDto.StartSessionRequest> requests
    ) {
        return Flux.fromIterable(requests)
                .parallel()
                .runOn(Schedulers.boundedElastic())
                .map(request -> mockExamService.startSession(request))
                .sequential()
                .collectList()
                .map(ResponseEntity::ok);
    }

    @PostMapping("/batch/questions")
    @Operation(summary = "Get batch exam questions", description = "Get questions for a list of exams in batch")
    public Mono<ResponseEntity<List<MockExamDto.GetQuestionsResponse>>> getQuestionsBatch(
            @RequestBody List<UUID> examIds
    ) {
        return Mono.fromCallable(() -> mockExamService.getQuestionsBatch(examIds))
                .subscribeOn(Schedulers.boundedElastic())
                .map(ResponseEntity::ok);
    }
}


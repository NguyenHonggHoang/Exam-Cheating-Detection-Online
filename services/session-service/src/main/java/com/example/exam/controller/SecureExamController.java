package com.example.exam.controller;

import com.example.exam.dto.SecureQuestionDto.*;
import com.example.exam.model.Exam;
import com.example.exam.model.ExamSessionState;
import com.example.exam.model.ExamSessionState.GeneratedQuestion;
import com.example.exam.model.ExamSessionState.SubmittedAnswer;
import com.example.exam.model.Session;
import com.example.exam.repository.ExamRepository;
import com.example.exam.repository.ExamSessionStateRepository;
import com.example.exam.repository.SessionRepository;
import com.example.exam.service.QuestionGeneratorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Secure Exam Controller
 * 
 * Key security features:
 * 1. NO endpoint to get all questions - only current question
 * 2. NO endpoint to go back - no backtracking
 * 3. Server-side time validation - can't manipulate client time
 * 4. Idle detection and session locking
 * 
 * @deprecated As of 2025-12-26, secure exam feature is not fully implemented or used.
 * Consider migrating to MockExamController with SEB integration.
 * This will be removed in a future version.
 */
@Deprecated
@RestController
@RequestMapping("/api/secure-exam")
@Tag(name = "Secure Exam", description = "Anti-screenshot secure exam endpoints")
public class SecureExamController {

    private static final Logger logger = LoggerFactory.getLogger(SecureExamController.class);

    private final SessionRepository sessionRepository;
    private final ExamRepository examRepository;
    private final ExamSessionStateRepository stateRepository;
    private final QuestionGeneratorService generatorService;

    public SecureExamController(
            SessionRepository sessionRepository,
            ExamRepository examRepository,
            ExamSessionStateRepository stateRepository,
            QuestionGeneratorService generatorService
    ) {
        this.sessionRepository = sessionRepository;
        this.examRepository = examRepository;
        this.stateRepository = stateRepository;
        this.generatorService = generatorService;
    }

    /**
     * Start a secure exam session.
     * Generates all questions with random values and returns metadata only.
     */
    @PostMapping("/{sessionId}/start")
    @Operation(summary = "Start secure exam", description = "Initialize session with randomized questions")
    public ResponseEntity<ExamStartResponse> startExam(@PathVariable UUID sessionId) {
        logger.info("Starting secure exam for session: {}", sessionId);

        // Get session and exam
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        Exam exam = examRepository.findById(session.getExamId())
                .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + session.getExamId()));

        // Initialize or get existing state
        ExamSessionState state = generatorService.initializeSession(sessionId, exam.getId());

        // Check if already locked or completed
        if (state.getIsLocked()) {
            throw new IllegalStateException("Session is locked: " + state.getLockReason());
        }

        if (state.getIsCompleted()) {
            throw new IllegalStateException("Exam is already completed");
        }

        return ResponseEntity.ok(new ExamStartResponse(
                sessionId.toString(),
                exam.getId().toString(),
                exam.getName(),
                state.getGeneratedQuestions().size(),
                exam.getDurationMinutes(),
                false, // No backtracking in secure mode
                30 // Idle timeout
        ));
    }

    /**
     * Get the current question.
     * Only returns ONE question - no peeking ahead!
     */
    @GetMapping("/{sessionId}/current-question")
    @Operation(summary = "Get current question", description = "Returns only the current question")
    public ResponseEntity<CurrentQuestionResponse> getCurrentQuestion(@PathVariable UUID sessionId) {
        ExamSessionState state = getActiveState(sessionId);

        // Update activity
        state.updateActivity();
        stateRepository.save(state);

        GeneratedQuestion current = state.getCurrentQuestion();
        if (current == null) {
            throw new IllegalStateException("No current question available");
        }

        return ResponseEntity.ok(CurrentQuestionResponse.from(
                current,
                state.getGeneratedQuestions().size(),
                state.getCurrentQuestionStartedAt()
        ));
    }

    /**
     * Submit an answer and get the next question.
     * No going back after this!
     */
    @PostMapping("/{sessionId}/submit-answer")
    @Operation(summary = "Submit answer", description = "Submit answer for current question, get next question")
    public ResponseEntity<SubmitAnswerResponse> submitAnswer(
            @PathVariable UUID sessionId,
            @RequestBody SubmitAnswerRequest request
    ) {
        logger.info("Submitting answer for session: {}", sessionId);

        ExamSessionState state = getActiveState(sessionId);
        GeneratedQuestion currentQuestion = state.getCurrentQuestion();

        if (currentQuestion == null) {
            throw new IllegalStateException("No current question to answer");
        }

        // Check if already answered this question
        boolean alreadyAnswered = state.getSubmittedAnswers().stream()
                .anyMatch(a -> a.getQuestionIndex().equals(currentQuestion.getQuestionIndex()));
        
        if (alreadyAnswered) {
            throw new IllegalStateException("Question already answered - no backtracking allowed");
        }

        // Calculate time spent
        Instant startedAt = state.getCurrentQuestionStartedAt();
        long timeSpentMs = startedAt != null 
                ? System.currentTimeMillis() - startedAt.toEpochMilli()
                : 0;

        // Check if time limit exceeded (with 5s grace period)
        int timeLimitMs = (currentQuestion.getTimeLimitSeconds() + 5) * 1000;
        if (timeSpentMs > timeLimitMs) {
            logger.warn("Time limit exceeded for session {}: {}ms > {}ms", sessionId, timeSpentMs, timeLimitMs);
            // Still accept but mark as overtime
        }

        // Record the answer
        SubmittedAnswer answer = new SubmittedAnswer();
        answer.setQuestionIndex(currentQuestion.getQuestionIndex());
        answer.setAnswer(request.answer() != null ? request.answer() : "");
        answer.setSubmittedAt(Instant.now());
        answer.setTimeSpentMs(timeSpentMs);
        answer.setIsCorrect(currentQuestion.getCorrectAnswer().equalsIgnoreCase(request.answer()));

        state.getSubmittedAnswers().add(answer);
        state.updateActivity();

        // Check if more questions
        if (state.hasMoreQuestions()) {
            state.moveToNextQuestion();
            stateRepository.save(state);

            GeneratedQuestion nextQuestion = state.getCurrentQuestion();
            CurrentQuestionResponse nextResponse = CurrentQuestionResponse.from(
                    nextQuestion,
                    state.getGeneratedQuestions().size(),
                    state.getCurrentQuestionStartedAt()
            );

            return ResponseEntity.ok(SubmitAnswerResponse.nextQuestion(
                    nextResponse,
                    state.getSubmittedAnswers().size(),
                    state.getGeneratedQuestions().size()
            ));
        } else {
            // Exam complete
            int score = calculateScore(state);
            state.completeExam(score);
            stateRepository.save(state);

            logger.info("Exam completed for session {}: score = {}", sessionId, score);

            return ResponseEntity.ok(SubmitAnswerResponse.examComplete(
                    state.getSubmittedAnswers().size(),
                    state.getGeneratedQuestions().size(),
                    score
            ));
        }
    }

    /**
     * Heartbeat for idle detection.
     * Returns OK even if session state doesn't exist yet (before /start is called).
     */
    @PostMapping("/{sessionId}/heartbeat")
    @Operation(summary = "Heartbeat", description = "Keep session alive and check status")
    public ResponseEntity<HeartbeatResponse> heartbeat(
            @PathVariable UUID sessionId,
            @RequestBody(required = false) HeartbeatRequest request
    ) {
        // Gracefully handle case where ExamSessionState doesn't exist yet
        var optionalState = stateRepository.findBySessionId(sessionId);
        
        if (optionalState.isEmpty()) {
            // Session state not created yet (exam not started via /start endpoint)
            // Return OK with defaults - this is normal during exam initialization
            return ResponseEntity.ok(new HeartbeatResponse(
                    true,  // ok
                    false, // not locked
                    null,  // no lock reason
                    0,     // questionIndex 0
                    0      // no remaining time
            ));
        }

        ExamSessionState state = optionalState.get();

        // Check if locked
        if (state.getIsLocked()) {
            return ResponseEntity.ok(new HeartbeatResponse(
                    false,
                    true,
                    state.getLockReason(),
                    state.getCurrentQuestionIndex(),
                    0
            ));
        }

        // Check if completed
        if (state.getIsCompleted()) {
            return ResponseEntity.ok(new HeartbeatResponse(
                    true,
                    false,
                    null,
                    state.getCurrentQuestionIndex(),
                    0
            ));
        }

        // Update activity
        state.updateActivity();
        stateRepository.save(state);

        // Calculate remaining time for current question
        GeneratedQuestion current = state.getCurrentQuestion();
        int remainingSeconds = 0;
        if (current != null && state.getCurrentQuestionStartedAt() != null) {
            long elapsed = (System.currentTimeMillis() - state.getCurrentQuestionStartedAt().toEpochMilli()) / 1000;
            remainingSeconds = Math.max(0, current.getTimeLimitSeconds() - (int) elapsed);
        }

        return ResponseEntity.ok(new HeartbeatResponse(
                true,
                false,
                null,
                state.getCurrentQuestionIndex(),
                remainingSeconds
        ));
    }

    /**
     * Get session status.
     */
    @GetMapping("/{sessionId}/status")
    @Operation(summary = "Get session status", description = "Check exam progress and status")
    public ResponseEntity<SessionStatusResponse> getStatus(@PathVariable UUID sessionId) {
        ExamSessionState state = stateRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        return ResponseEntity.ok(new SessionStatusResponse(
                sessionId.toString(),
                state.getCurrentQuestionIndex(),
                state.getGeneratedQuestions().size(),
                state.getSubmittedAnswers().size(),
                state.getIsLocked(),
                state.getLockReason(),
                state.getIsCompleted(),
                state.getFinalScore(),
                state.getLastActivityAt().toEpochMilli()
        ));
    }

    /**
     * Lock session manually (e.g., from proctor).
     */
    @PostMapping("/{sessionId}/lock")
    @Operation(summary = "Lock session", description = "Lock exam session with reason")
    public ResponseEntity<Void> lockSession(
            @PathVariable UUID sessionId,
            @RequestParam(defaultValue = "Manual lock") String reason
    ) {
        ExamSessionState state = stateRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        state.lockSession(reason);
        stateRepository.save(state);

        logger.info("Session {} locked: {}", sessionId, reason);
        return ResponseEntity.ok().build();
    }

    // ========== Helper Methods ==========

    private ExamSessionState getActiveState(UUID sessionId) {
        ExamSessionState state = stateRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        if (state.getIsLocked()) {
            throw new IllegalStateException("Session is locked: " + state.getLockReason());
        }

        if (state.getIsCompleted()) {
            throw new IllegalStateException("Exam is already completed");
        }

        return state;
    }

    private int calculateScore(ExamSessionState state) {
        int totalPoints = 0;
        int earnedPoints = 0;

        for (int i = 0; i < state.getGeneratedQuestions().size(); i++) {
            GeneratedQuestion q = state.getGeneratedQuestions().get(i);
            totalPoints += q.getPoints();

            final int currentIndex = i;
            // Find submitted answer
            SubmittedAnswer answer = state.getSubmittedAnswers().stream()
                    .filter(a -> a.getQuestionIndex() == currentIndex)
                    .findFirst()
                    .orElse(null);

            if (answer != null && Boolean.TRUE.equals(answer.getIsCorrect())) {
                earnedPoints += q.getPoints();
            }
        }

        // Return percentage score
        return totalPoints > 0 ? (earnedPoints * 100) / totalPoints : 0;
    }
}

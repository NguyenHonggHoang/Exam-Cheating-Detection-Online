package com.example.exam.controller;

import com.example.exam.dto.SessionResponse;
import com.example.exam.dto.StartSessionRequest;
import com.example.exam.model.Session;
import com.example.exam.model.SessionStatus;
import com.example.exam.repository.SessionRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.lang.NonNull;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private final SessionRepository sessionRepository;

    public SessionController(SessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
    }

    // Start a session
    @PostMapping("/start")
    @io.swagger.v3.oas.annotations.Operation(
        summary = "Start a session",
        description = "Creates a new exam session for a given examId and current user"
    )
    public ResponseEntity<SessionResponse> startSession(@Valid @RequestBody StartSessionRequest req) {
        Session s = new Session();
        s.setExamId(req.getExamId());
        // Get userId from JWT token
        s.setUserId(com.example.exam.util.SecurityUtils.getCurrentUserId());
        s.setStartedAt(Instant.now());
        s.setStatus(SessionStatus.ACTIVE);
        Session saved = sessionRepository.save(s);
        return ResponseEntity.ok(SessionResponse.from(saved));
    }

    // List sessions (simple pagination later)
    @GetMapping
    @io.swagger.v3.oas.annotations.Operation(
        summary = "List sessions",
        description = "Returns all sessions (pagination to be added later)"
    )
    public ResponseEntity<List<SessionResponse>> listSessions() {
        List<SessionResponse> data = sessionRepository.findAll().stream().map(SessionResponse::from).toList();
        return ResponseEntity.ok(data);
    }

    // Get session by id
    @GetMapping("/{id}")
    @io.swagger.v3.oas.annotations.Operation(
        summary = "Get a session",
        description = "Returns a session by its ID"
    )
    public ResponseEntity<SessionResponse> getSession(@PathVariable("id") @NonNull UUID id) {
        return sessionRepository.findById(id)
                .map(SessionResponse::from)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/end")
    @io.swagger.v3.oas.annotations.Operation(
        summary = "End a session",
        description = "Marks the session as ENDED and sets endedAt"
    )
    public ResponseEntity<?> endSession(@PathVariable("id") @NonNull UUID id) {
        Optional<Session> maybe = sessionRepository.findById(id);
        if (maybe.isEmpty()) return ResponseEntity.notFound().build();
        Session s = maybe.get();
        s.setEndedAt(Instant.now());
        s.setStatus(SessionStatus.ENDED);
        Session saved = sessionRepository.save(s);
        return ResponseEntity.ok(SessionResponse.from(saved));
    }

    // Get all sessions for a specific user
    @GetMapping("/user/{userId}")
    @io.swagger.v3.oas.annotations.Operation(
        summary = "Get sessions by user",
        description = "Returns all sessions for a specific user, ordered by started_at descending"
    )
    public ResponseEntity<List<SessionResponse>> getSessionsByUser(@PathVariable("userId") @NonNull String userId) {
        try {
            List<SessionResponse> sessions = sessionRepository.findByUserIdOrderByStartedAtDesc(userId)
                    .stream()
                    .map(SessionResponse::from)
                    .toList();
            return ResponseEntity.ok(sessions);
        } catch (Exception e) {
            e.printStackTrace();
            throw e;
        }
    }
}

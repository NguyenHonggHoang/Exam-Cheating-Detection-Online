package com.example.exam.controller;

import com.example.exam.dto.AnswerLogDto;
import com.example.exam.dto.SessionResponse;
import com.example.exam.dto.StartSessionRequest;
import com.example.exam.model.Session;
import com.example.exam.model.SessionStatus;
import com.example.exam.repository.AnswerLogRepository;
import com.example.exam.repository.SessionRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.lang.NonNull;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private final SessionRepository sessionRepository;
    private final AnswerLogRepository answerLogRepository;
    private final com.example.exam.repository.ExamRepository examRepository;
    private final com.example.exam.service.LiveKitTokenService liveKitTokenService;

    public SessionController(
            SessionRepository sessionRepository,
            AnswerLogRepository answerLogRepository,
            com.example.exam.repository.ExamRepository examRepository,
            com.example.exam.service.LiveKitTokenService liveKitTokenService
    ) {
        this.sessionRepository = sessionRepository;
        this.answerLogRepository = answerLogRepository;
        this.examRepository = examRepository;
        this.liveKitTokenService = liveKitTokenService;
    }

    // Start a session
    @PostMapping("/start")
    @io.swagger.v3.oas.annotations.Operation(
        summary = "Start a session",
        description = "Creates a new exam session for a given examId and current user. Validates attempt limits."
    )
    public ResponseEntity<?> startSession(@Valid @RequestBody StartSessionRequest req) {
        String userId = com.example.exam.util.SecurityUtils.getCurrentUserId();
        UUID examId = req.getExamId();
        
        // Get exam to check maxAttempts
        var optExam = examRepository.findById(examId);
        if (optExam.isEmpty()) {
            return ResponseEntity.badRequest()
                .body(java.util.Map.of("error", "Exam not found"));
        }
        
        var exam = optExam.get();
        Integer maxAttempts = exam.getMaxAttempts();
        
        // Check if user has an active session for this exam
        var activeSessions = sessionRepository.findByExamIdAndUserIdAndStatus(
            examId, userId, SessionStatus.ACTIVE
        );
        if (!activeSessions.isEmpty()) {
            // Return existing active session
            return ResponseEntity.ok(SessionResponse.from(activeSessions.get(0)));
        }
        
        // Check attempt limit (null = unlimited)
        if (maxAttempts != null) {
            int attemptCount = sessionRepository.countByExamIdAndUserId(examId, userId);
            if (attemptCount >= maxAttempts) {
                return ResponseEntity.status(403)
                    .body(java.util.Map.of(
                        "error", "Maximum attempts exceeded",
                        "maxAttempts", maxAttempts,
                        "attemptCount", attemptCount,
                        "message", "You have reached the maximum number of attempts for this exam"
                    ));
            }
        }
        
        // Create new session
        Session s = new Session();
        s.setExamId(examId);
        s.setUserId(userId);
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

    /**
     * Get answer logs for a session
     * 
     * Returns all answer logs ordered by question index for proctor dashboard.
     * 
     * GET /api/sessions/{sessionId}/answer-logs
     */
    @GetMapping("/{sessionId}/answer-logs")
    @io.swagger.v3.oas.annotations.Operation(
        summary = "Get answer logs for a session",
        description = "Returns all answer logs for a session ordered by question index"
    )
    public ResponseEntity<?> getAnswerLogs(@PathVariable("sessionId") @NonNull UUID sessionId) {
        // Verify session exists
        Optional<Session> sessionOpt = sessionRepository.findById(sessionId);
        if (sessionOpt.isEmpty()) {
            return ResponseEntity.status(404)
                .body(Map.of(
                    "error", "Session not found",
                    "sessionId", sessionId.toString()
                ));
        }
        
        // Get answer logs ordered by question index
        List<AnswerLogDto> answerLogs = answerLogRepository
            .findBySessionIdOrderByQuestionIndex(sessionId)
            .stream()
            .map(AnswerLogDto::from)
            .toList();
        
        return ResponseEntity.ok(Map.of(
            "content", answerLogs,
            "totalElements", answerLogs.size()
        ));
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

    // Join LiveKit Room (Get WebRTC Token)
    @PostMapping("/{id}/join")
    @io.swagger.v3.oas.annotations.Operation(
        summary = "Join exam room",
        description = "Generates a LiveKit access token for joining the WebRTC room"
    )
    public ResponseEntity<?> joinRoom(@PathVariable("id") @NonNull UUID id) {
        // Verify session exists
     Optional<Session> sessionOpt = sessionRepository.findById(id);
        if (sessionOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Session session = sessionOpt.get();
        
        // Try to get user ID from auth context, fallback to session's user ID
        String userId;
        try {
            userId = com.example.exam.util.SecurityUtils.getCurrentUserId();
        } catch (Exception e) {
            // No auth context, use the session's user ID
            userId = session.getUserId();
        }

        // Generate LiveKit token
        // Room name = sessionId, Participant = userId
        java.util.Map<String, String> tokenData = liveKitTokenService.generateToken(
                session.getId().toString(),
                userId,
                "Student-" + userId
        );

        return ResponseEntity.ok(tokenData);
    }

    /**
     * Internal Session Join Endpoint
     * Called by Next.js BFF when student clicks "Start Exam"
     * 
     * POST /internal/session/join
     * {
     *   "examId": "uuid"
     * }
     * 
     * Response:
     * {
     *   "sessionId": "uuid",
     *   "token": "livekit-jwt",
     *   "wsUrl": "ws://livekit:7880",
     *   "examName": "Final Exam",
     *   "duration": 120
     * }
     */
    @PostMapping("/internal/session/join")
    @io.swagger.v3.oas.annotations.Operation(
        summary = "Join exam session",
        description = "Creates session, validates exam, and generates LiveKit token"
    )
    public ResponseEntity<?> joinExamSession(@RequestBody JoinExamRequest request) {
        try {
            // Step 1: Get authenticated user from JWT
            String userId = com.example.exam.util.SecurityUtils.getCurrentUserId();
            
            // Step 2: Validate exam exists and is active
            // TODO: Query from exam table when implemented
            // For now, just validate examId is not null
            if (request.examId() == null || request.examId().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(java.util.Map.of("error", "Invalid examId"));
            }
            
            // Step 3: Create session record
            Session session = new Session();
            session.setExamId(UUID.fromString(request.examId()));
            session.setUserId(userId);
            session.setStartedAt(Instant.now());
            session.setStatus(SessionStatus.ACTIVE);
            Session savedSession = sessionRepository.save(session);
            
            // Step 4: Generate LiveKit token
            java.util.Map<String, String> liveKitData = liveKitTokenService.generateToken(
                savedSession.getId().toString(),
                userId,
                "Student-" + userId
            );
            
            // Step 5: Return combined response
            return ResponseEntity.ok(java.util.Map.of(
                "sessionId", savedSession.getId().toString(),
                "token", liveKitData.get("token"),
                "wsUrl", liveKitData.get("wsUrl"),
                "roomName", liveKitData.get("roomName"),
                "examName", "Exam " + request.examId(),  // TODO: Fetch from exam table
                "duration", 120,  // TODO: Get from exam metadata
                "startedAt", savedSession.getStartedAt().toString()
            ));
            
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(java.util.Map.of("error", "Failed to join exam: " + e.getMessage()));
        }
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

    /**
     * Complete session
     * 
     * Marks session as COMPLETED (different from ENDED)
     * Used when student successfully submits exam
     */
    @PostMapping("/{id}/complete")
    @io.swagger.v3.oas.annotations.Operation(
        summary = "Complete session",
        description = "Marks session as COMPLETED when exam is submitted"
    )
    public ResponseEntity<?> completeSession(@PathVariable("id") @NonNull UUID id) {
        Optional<Session> maybe = sessionRepository.findById(id);
        if (maybe.isEmpty()) return ResponseEntity.notFound().build();
        
        Session s = maybe.get();
        
        // Can only complete active sessions
        if (s.getStatus() != SessionStatus.ACTIVE) {
            return ResponseEntity.badRequest()
                .body(java.util.Map.of("error", "Session is not active"));
        }
        
        s.setEndedAt(Instant.now());
        s.setStatus(SessionStatus.ENDED);  // or COMPLETED if you add that status
        Session saved = sessionRepository.save(s);
        return ResponseEntity.ok(SessionResponse.from(saved));
    }

    /**
     * Update session status
     * 
     * Allows changing session status (ACTIVE, PAUSED, ABORTED, etc.)
     */
    @PatchMapping("/{id}/status")
    @io.swagger.v3.oas.annotations.Operation(
        summary = "Update session status",
        description = "Change session status (ACTIVE, PAUSED, ABORTED, ENDED)"
    )
    public ResponseEntity<?> updateSessionStatus(
            @PathVariable("id") @NonNull UUID id,
            @RequestBody UpdateSessionStatusRequest request
    ) {
        Optional<Session> maybe = sessionRepository.findById(id);
        if (maybe.isEmpty()) return ResponseEntity.notFound().build();
        
        Session s = maybe.get();
        
        try {
            SessionStatus newStatus = SessionStatus.valueOf(request.status());
            s.setStatus(newStatus);
            
            // Set endedAt if ending session
            if (newStatus == SessionStatus.ENDED || newStatus == SessionStatus.ABORTED) {
                s.setEndedAt(Instant.now());
            }
            
            Session saved = sessionRepository.save(s);
            return ResponseEntity.ok(SessionResponse.from(saved));
            
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                .body(java.util.Map.of("error", "Invalid status: " + request.status()));
        }
    }

    /**
     * Get all sessions for an exam
     * 
     * For proctor dashboard - view all student sessions for an exam
     */
    @GetMapping("/exam/{examId}")
    @io.swagger.v3.oas.annotations.Operation(
        summary = "Get sessions by exam",
        description = "Returns all sessions for a specific exam, with optional status filter"
    )
    public ResponseEntity<List<SessionResponse>> getSessionsByExam(
            @PathVariable("examId") @NonNull String examId,
            @RequestParam(value = "status", required = false) String status
    ) {
        List<Session> sessions;
        UUID examUuid = UUID.fromString(examId);
        
        if (status != null) {
            try {
                SessionStatus statusEnum = SessionStatus.valueOf(status);
                sessions = sessionRepository.findByExamIdAndStatus(examUuid, statusEnum);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().build();
            }
        } else {
            sessions = sessionRepository.findByExamIdOrderByStartedAtDesc(examUuid);
        }
        
        return ResponseEntity.ok(
            sessions.stream()
                .map(SessionResponse::from)
                .toList()
        );
    }

    /**
     * Get proctor token to monitor a room
     * 
     * Allows proctors to view student video streams without being visible
     */
    @GetMapping("/proctor-token")
    @io.swagger.v3.oas.annotations.Operation(
        summary = "Get proctor token for LiveKit",
        description = "Generates a LiveKit token for proctors to monitor student streams"
    )
    public ResponseEntity<java.util.Map<String, String>> getProctorToken(
            @RequestParam("roomName") String roomName
    ) {
        String proctorId = com.example.exam.util.SecurityUtils.getCurrentUserId();
        // No fallback to anonymous proctor - security requirement
        
        var tokenData = liveKitTokenService.generateProctorToken(roomName, proctorId);
        return ResponseEntity.ok(tokenData);
    }

    // ========== Calibration Endpoints ==========

    /**
     * Session Heartbeat
     * 
     * POST /sessions/{id}/heartbeat
     * Updates last activity timestamp (Future implementation)
     */
    @PostMapping("/{id}/heartbeat")
    public ResponseEntity<Void> heartbeat(@PathVariable("id") @NonNull UUID id) {
        // Future: Update last_activity in DB
        return ResponseEntity.ok().build();
    }
    
    /**
     * Save gaze calibration data for a session
     * 
     * POST /sessions/{id}/calibration
     * Body: CalibrationData JSON
     */
    @PostMapping("/{id}/calibration")
    public ResponseEntity<Void> saveCalibration(
            @PathVariable("id") @NonNull UUID id,
            @RequestBody CalibrationData calibration
    ) {
        Optional<Session> optSession = sessionRepository.findById(id);
        if (optSession.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        Session session = optSession.get();
        session.setCalibrationData(calibration.toJson());
        session.setCalibrationTimestamp(Instant.now());
        sessionRepository.save(session);
        
        return ResponseEntity.ok().build();
    }
    
    /**
     * Get gaze calibration data for a session
     * 
     * GET /sessions/{id}/calibration
     */
    @GetMapping("/{id}/calibration")
    public ResponseEntity<String> getCalibration(@PathVariable("id") @NonNull UUID id) {
        Optional<Session> optSession = sessionRepository.findById(id);
        if (optSession.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        Session session = optSession.get();
        String calibrationData = session.getCalibrationData();
        
        if (calibrationData == null || calibrationData.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        // Check if calibration is too old (30 minutes)
        Instant calibrationTime = session.getCalibrationTimestamp();
        if (calibrationTime != null) {
            long ageMinutes = java.time.Duration.between(calibrationTime, Instant.now()).toMinutes();
            if (ageMinutes > 30) {
                // Calibration expired
                return ResponseEntity.status(410).body("{\"error\": \"Calibration expired\"}");
            }
        }
        
        return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .body(calibrationData);
    }

    // DTOs for new endpoints
    record JoinExamRequest(String examId) {}
    record UpdateSessionStatusRequest(String status) {}
    
    /**
     * Calibration data DTO
     */
    record CalibrationData(
        Corners corners,
        Boundaries boundaries,
        long timestamp
    ) {
        record Corners(
            HeadPose center,
            HeadPose topLeft,
            HeadPose topRight,
            HeadPose bottomRight,
            HeadPose bottomLeft
        ) {}
        
        record Boundaries(
            double minPitch,
            double maxPitch,
            double minYaw,
            double maxYaw
        ) {}
        
        record HeadPose(double pitch, double yaw, double roll) {}
        
        public String toJson() {
            try {
                return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(this);
            } catch (Exception e) {
                return "{}";
            }
        }
    }
}


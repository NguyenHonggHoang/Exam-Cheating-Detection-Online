package com.example.exam.dto;

import com.example.exam.model.Session;
import com.example.exam.model.SessionStatus;
import java.time.Instant;
import java.util.UUID;

public class SessionResponse {
    private UUID id;
    private String userId;
    private UUID examId;
    private Instant startedAt;
    private Instant endedAt;
    private SessionStatus status;

    public static SessionResponse from(Session s) {
        SessionResponse r = new SessionResponse();
        r.id = s.getId();
        r.userId = s.getUserId();
        r.examId = s.getExamId();
        r.startedAt = s.getStartedAt();
        r.endedAt = s.getEndedAt();
        r.status = s.getStatus();
        return r;
    }

    public UUID getId() { return id; }
    public String getUserId() { return userId; }
    public UUID getExamId() { return examId; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getEndedAt() { return endedAt; }
    public SessionStatus getStatus() { return status; }
}

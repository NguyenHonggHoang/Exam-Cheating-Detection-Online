package com.example.exam.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sessions")
public class Session {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "exam_id", nullable = false)
    private UUID examId;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", columnDefinition = "session_status")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.NAMED_ENUM)
    private SessionStatus status;
    
    @Column(name = "calibration_data", columnDefinition = "TEXT")
    private String calibrationData;
    
    @Column(name = "calibration_timestamp")
    private Instant calibrationTimestamp;

    public Session() {
        this.id = UUID.randomUUID();
    }

    // getters and setters
    public UUID getId() { return id; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public UUID getExamId() { return examId; }
    public void setExamId(UUID examId) { this.examId = examId; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getEndedAt() { return endedAt; }
    public void setEndedAt(Instant endedAt) { this.endedAt = endedAt; }
    public SessionStatus getStatus() { return status; }
    public void setStatus(SessionStatus status) { this.status = status; }
    
    // Calibration getters/setters
    public String getCalibrationData() { return calibrationData; }
    public void setCalibrationData(String calibrationData) { this.calibrationData = calibrationData; }
    public Instant getCalibrationTimestamp() { return calibrationTimestamp; }
    public void setCalibrationTimestamp(Instant calibrationTimestamp) { this.calibrationTimestamp = calibrationTimestamp; }
}


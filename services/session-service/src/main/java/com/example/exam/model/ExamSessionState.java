package com.example.exam.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Exam Session State - tracks current question and prevents backtracking.
 * 
 * Each session has its own pre-generated questions with randomized values,
 * making each student's test unique.
 */
@Entity
@Table(name = "exam_session_states")
public class ExamSessionState {

    @Id
    private UUID id;

    @Column(name = "session_id", nullable = false, unique = true)
    private UUID sessionId;

    /**
     * Current question index (0-based).
     */
    @Column(name = "current_question_index", nullable = false)
    private Integer currentQuestionIndex = 0;

    /**
     * Pre-generated questions for this session.
     * Contains randomized text, options, and correct answers.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "generated_questions", columnDefinition = "jsonb", nullable = false)
    private List<GeneratedQuestion> generatedQuestions = new ArrayList<>();

    /**
     * Submitted answers - cannot go back!
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "submitted_answers", columnDefinition = "jsonb", nullable = false)
    private List<SubmittedAnswer> submittedAnswers = new ArrayList<>();

    /**
     * Last activity timestamp for idle detection.
     */
    @Column(name = "last_activity_at", nullable = false)
    private Instant lastActivityAt;

    /**
     * When the current question was started.
     */
    @Column(name = "current_question_started_at")
    private Instant currentQuestionStartedAt;

    /**
     * Whether the session is locked (timeout or idle).
     */
    @Column(name = "is_locked", nullable = false)
    private Boolean isLocked = false;

    @Column(name = "lock_reason", length = 100)
    private String lockReason;

    @Column(name = "locked_at")
    private Instant lockedAt;

    /**
     * Whether the exam is completed.
     */
    @Column(name = "is_completed", nullable = false)
    private Boolean isCompleted = false;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "final_score")
    private Integer finalScore;

    /**
     * Behavior analysis score (0-100, higher = more suspicious)
     */
    @Column(name = "behavior_score")
    private Integer behaviorScore;

    /**
     * Behavior anomalies detected (JSON array)
     */
    @Column(name = "behavior_anomalies", columnDefinition = "TEXT")
    private String behaviorAnomalies;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public ExamSessionState() {
        this.id = UUID.randomUUID();
        this.lastActivityAt = Instant.now();
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
        if (this.lastActivityAt == null) {
            this.lastActivityAt = Instant.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // ========== Generated Question Inner Class ==========

    /**
     * A question generated from a template with specific values.
     */
    public static class GeneratedQuestion {
        private UUID templateId;
        private Integer questionIndex;
        private String generatedText;
        private String type;
        private List<String> generatedOptions;
        private String correctAnswer;
        private Map<String, Object> params; // The random values used
        private Integer timeLimitSeconds;
        private Integer points;
        private String difficulty;

        public GeneratedQuestion() {}

        public UUID getTemplateId() { return templateId; }
        public void setTemplateId(UUID templateId) { this.templateId = templateId; }

        public Integer getQuestionIndex() { return questionIndex; }
        public void setQuestionIndex(Integer questionIndex) { this.questionIndex = questionIndex; }

        public String getGeneratedText() { return generatedText; }
        public void setGeneratedText(String generatedText) { this.generatedText = generatedText; }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public List<String> getGeneratedOptions() { return generatedOptions; }
        public void setGeneratedOptions(List<String> generatedOptions) { this.generatedOptions = generatedOptions; }

        public String getCorrectAnswer() { return correctAnswer; }
        public void setCorrectAnswer(String correctAnswer) { this.correctAnswer = correctAnswer; }

        public Map<String, Object> getParams() { return params; }
        public void setParams(Map<String, Object> params) { this.params = params; }

        public Integer getTimeLimitSeconds() { return timeLimitSeconds; }
        public void setTimeLimitSeconds(Integer timeLimitSeconds) { this.timeLimitSeconds = timeLimitSeconds; }

        public Integer getPoints() { return points; }
        public void setPoints(Integer points) { this.points = points; }

        public String getDifficulty() { return difficulty; }
        public void setDifficulty(String difficulty) { this.difficulty = difficulty; }
    }

    // ========== Submitted Answer Inner Class ==========

    /**
     * A submitted answer with detailed behavior metrics for cheating detection.
     */
    public static class SubmittedAnswer {
        private Integer questionIndex;
        private String answer;
        private Instant submittedAt;
        private Long timeSpentMs;
        private Boolean isCorrect;
        
        // Answer behavior metrics
        private Integer revisionCount; // Number of times answer was changed
        private List<AnswerChange> answerChanges; // History of answer changes
        private Double averageTypingSpeed; // Characters per second
        private Boolean hadPreSuspicionDuring; // Pre-suspicion occurred during this question
        private String difficulty; // Question difficulty: easy/medium/hard

        public SubmittedAnswer() {}

        public Integer getQuestionIndex() { return questionIndex; }
        public void setQuestionIndex(Integer questionIndex) { this.questionIndex = questionIndex; }

        public String getAnswer() { return answer; }
        public void setAnswer(String answer) { this.answer = answer; }

        public Instant getSubmittedAt() { return submittedAt; }
        public void setSubmittedAt(Instant submittedAt) { this.submittedAt = submittedAt; }

        public Long getTimeSpentMs() { return timeSpentMs; }
        public void setTimeSpentMs(Long timeSpentMs) { this.timeSpentMs = timeSpentMs; }

        public Boolean getIsCorrect() { return isCorrect; }
        public void setIsCorrect(Boolean isCorrect) { this.isCorrect = isCorrect; }
        
        // Behavior metrics getters/setters
        public Integer getRevisionCount() { return revisionCount; }
        public void setRevisionCount(Integer revisionCount) { this.revisionCount = revisionCount; }
        
        public List<AnswerChange> getAnswerChanges() { return answerChanges; }
        public void setAnswerChanges(List<AnswerChange> answerChanges) { this.answerChanges = answerChanges; }
        
        public Double getAverageTypingSpeed() { return averageTypingSpeed; }
        public void setAverageTypingSpeed(Double averageTypingSpeed) { this.averageTypingSpeed = averageTypingSpeed; }
        
        public Boolean getHadPreSuspicionDuring() { return hadPreSuspicionDuring; }
        public void setHadPreSuspicionDuring(Boolean hadPreSuspicionDuring) { this.hadPreSuspicionDuring = hadPreSuspicionDuring; }
        
        public String getDifficulty() { return difficulty; }
        public void setDifficulty(String difficulty) { this.difficulty = difficulty; }
    }
    
    /**
     * Answer change history for revision tracking.
     */
    public static class AnswerChange {
        private String fromAnswer;
        private String toAnswer;
        private Long timestamp; // Epoch milliseconds
        private String reason; // initial, revision, final
        
        public AnswerChange() {}
        
        public String getFromAnswer() { return fromAnswer; }
        public void setFromAnswer(String fromAnswer) { this.fromAnswer = fromAnswer; }
        
        public String getToAnswer() { return toAnswer; }
        public void setToAnswer(String toAnswer) { this.toAnswer = toAnswer; }
        
        public Long getTimestamp() { return timestamp; }
        public void setTimestamp(Long timestamp) { this.timestamp = timestamp; }
        
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
    }

    // ========== Helper Methods ==========

    public void lockSession(String reason) {
        this.isLocked = true;
        this.lockReason = reason;
        this.lockedAt = Instant.now();
    }

    public void completeExam(int score) {
        this.isCompleted = true;
        this.completedAt = Instant.now();
        this.finalScore = score;
    }

    public void updateActivity() {
        this.lastActivityAt = Instant.now();
    }

    public GeneratedQuestion getCurrentQuestion() {
        if (currentQuestionIndex >= 0 && currentQuestionIndex < generatedQuestions.size()) {
            return generatedQuestions.get(currentQuestionIndex);
        }
        return null;
    }

    public boolean hasMoreQuestions() {
        return currentQuestionIndex < generatedQuestions.size() - 1;
    }

    public void moveToNextQuestion() {
        this.currentQuestionIndex++;
        this.currentQuestionStartedAt = Instant.now();
    }

    // ========== Getters and Setters ==========

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getSessionId() { return sessionId; }
    public void setSessionId(UUID sessionId) { this.sessionId = sessionId; }

    public Integer getCurrentQuestionIndex() { return currentQuestionIndex; }
    public void setCurrentQuestionIndex(Integer currentQuestionIndex) { this.currentQuestionIndex = currentQuestionIndex; }

    public List<GeneratedQuestion> getGeneratedQuestions() { return generatedQuestions; }
    public void setGeneratedQuestions(List<GeneratedQuestion> generatedQuestions) { this.generatedQuestions = generatedQuestions; }

    public List<SubmittedAnswer> getSubmittedAnswers() { return submittedAnswers; }
    public void setSubmittedAnswers(List<SubmittedAnswer> submittedAnswers) { this.submittedAnswers = submittedAnswers; }

    public Instant getLastActivityAt() { return lastActivityAt; }
    public void setLastActivityAt(Instant lastActivityAt) { this.lastActivityAt = lastActivityAt; }

    public Instant getCurrentQuestionStartedAt() { return currentQuestionStartedAt; }
    public void setCurrentQuestionStartedAt(Instant currentQuestionStartedAt) { this.currentQuestionStartedAt = currentQuestionStartedAt; }

    public Boolean getIsLocked() { return isLocked; }
    public void setIsLocked(Boolean isLocked) { this.isLocked = isLocked; }

    public String getLockReason() { return lockReason; }
    public void setLockReason(String lockReason) { this.lockReason = lockReason; }

    public Instant getLockedAt() { return lockedAt; }
    public void setLockedAt(Instant lockedAt) { this.lockedAt = lockedAt; }

    public Boolean getIsCompleted() { return isCompleted; }
    public void setIsCompleted(Boolean isCompleted) { this.isCompleted = isCompleted; }

    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }

    public Integer getFinalScore() { return finalScore; }
    public void setFinalScore(Integer finalScore) { this.finalScore = finalScore; }

    public Integer getBehaviorScore() { return behaviorScore; }
    public void setBehaviorScore(Integer behaviorScore) { this.behaviorScore = behaviorScore; }

    public String getBehaviorAnomalies() { return behaviorAnomalies; }
    public void setBehaviorAnomalies(String behaviorAnomalies) { this.behaviorAnomalies = behaviorAnomalies; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

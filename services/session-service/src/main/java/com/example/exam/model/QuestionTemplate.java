package com.example.exam.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.List;
import java.util.UUID;

/**
 * Question Template with dynamic parameters for anti-screenshot protection.
 * 
 * Each template can have placeholders like {{A}}, {{B}} that are replaced
 * with random values at runtime, making each student's test unique.
 */
@Entity
@Table(name = "question_templates")
public class QuestionTemplate {

    public enum TemplateType {
        MULTIPLE_CHOICE,
        TEXT,
        TRUE_FALSE
    }

    public enum Difficulty {
        easy,
        medium,
        hard
    }

    @Id
    private UUID id;

    @Column(name = "exam_id", nullable = false)
    private UUID examId;

    @Column(name = "question_order", nullable = false)
    private Integer questionOrder;

    /**
     * Template text with placeholders.
     * Example: "What is {{A}} + {{B}}?"
     */
    @Column(name = "template_text", nullable = false, columnDefinition = "TEXT")
    private String templateText;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private TemplateType type = TemplateType.MULTIPLE_CHOICE;

    /**
     * Parameter configuration for randomization.
     * Example: { "A": {"type": "integer", "min": 10, "max": 99} }
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "parameters", columnDefinition = "jsonb")
    private Map<String, ParameterConfig> parameters;

    /**
     * Options template with placeholders (for MULTIPLE_CHOICE).
     * Example: ["{{A}} + {{B}}", "{{A}} - {{B}}"]
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "options_template", columnDefinition = "jsonb")
    private List<String> optionsTemplate;

    /**
     * Answer formula - evaluated with parameters.
     * Example: "{{A}} + {{B}}" or static like "Paris"
     */
    @Column(name = "answer_formula", length = 500)
    private String answerFormula;

    @Enumerated(EnumType.STRING)
    @Column(name = "difficulty", nullable = false)
    private Difficulty difficulty = Difficulty.medium;

    /**
     * Time limit for this question in seconds.
     */
    @Column(name = "time_limit_seconds", nullable = false)
    private Integer timeLimitSeconds = 60;

    @Column(name = "points", nullable = false)
    private Integer points = 1;

    /**
     * Whether this question depends on the previous answer.
     */
    @Column(name = "depends_on_previous")
    private Boolean dependsOnPrevious = false;

    /**
     * Formula that uses previous answer.
     * Example: "{{PREV_ANSWER}} - 42"
     */
    @Column(name = "dependency_formula", length = 500)
    private String dependencyFormula;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public QuestionTemplate() {
        this.id = UUID.randomUUID();
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // ========== Parameter Config Inner Class ==========

    /**
     * Configuration for a single parameter.
     */
    public static class ParameterConfig {
        private String type;  // "integer", "float", "choice"
        private Integer min;
        private Integer max;
        private List<String> choices;  // For choice type

        public ParameterConfig() {}

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public Integer getMin() { return min; }
        public void setMin(Integer min) { this.min = min; }

        public Integer getMax() { return max; }
        public void setMax(Integer max) { this.max = max; }

        public List<String> getChoices() { return choices; }
        public void setChoices(List<String> choices) { this.choices = choices; }
    }

    // ========== Getters and Setters ==========

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getExamId() { return examId; }
    public void setExamId(UUID examId) { this.examId = examId; }

    public Integer getQuestionOrder() { return questionOrder; }
    public void setQuestionOrder(Integer questionOrder) { this.questionOrder = questionOrder; }

    public String getTemplateText() { return templateText; }
    public void setTemplateText(String templateText) { this.templateText = templateText; }

    public TemplateType getType() { return type; }
    public void setType(TemplateType type) { this.type = type; }

    public Map<String, ParameterConfig> getParameters() { return parameters; }
    public void setParameters(Map<String, ParameterConfig> parameters) { this.parameters = parameters; }

    public List<String> getOptionsTemplate() { return optionsTemplate; }
    public void setOptionsTemplate(List<String> optionsTemplate) { this.optionsTemplate = optionsTemplate; }

    public String getAnswerFormula() { return answerFormula; }
    public void setAnswerFormula(String answerFormula) { this.answerFormula = answerFormula; }

    public Difficulty getDifficulty() { return difficulty; }
    public void setDifficulty(Difficulty difficulty) { this.difficulty = difficulty; }

    public Integer getTimeLimitSeconds() { return timeLimitSeconds; }
    public void setTimeLimitSeconds(Integer timeLimitSeconds) { this.timeLimitSeconds = timeLimitSeconds; }

    public Integer getPoints() { return points; }
    public void setPoints(Integer points) { this.points = points; }

    public Boolean getDependsOnPrevious() { return dependsOnPrevious; }
    public void setDependsOnPrevious(Boolean dependsOnPrevious) { this.dependsOnPrevious = dependsOnPrevious; }

    public String getDependencyFormula() { return dependencyFormula; }
    public void setDependencyFormula(String dependencyFormula) { this.dependencyFormula = dependencyFormula; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

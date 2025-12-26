package com.example.exam.service;

import com.example.exam.model.ExamSessionState;
import com.example.exam.model.ExamSessionState.GeneratedQuestion;
import com.example.exam.model.QuestionTemplate;
import com.example.exam.model.QuestionTemplate.ParameterConfig;
import com.example.exam.repository.ExamSessionStateRepository;
import com.example.exam.repository.QuestionTemplateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import javax.script.ScriptException;
import java.time.Instant;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service for generating randomized questions from templates.
 * 
 * Each student gets unique questions with different values,
 * making screenshot sharing ineffective.
 * 
 * @deprecated As of 2025-12-26, secure exam feature with question generation is not used.
 * This service supports deprecated SecureExamController.
 * This will be removed in a future version.
 */
@Deprecated
@Service
public class QuestionGeneratorService {

    private static final Logger logger = LoggerFactory.getLogger(QuestionGeneratorService.class);
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\{\\{(\\w+)\\}\\}");

    private final QuestionTemplateRepository templateRepository;
    private final ExamSessionStateRepository stateRepository;
    private final Random random = new Random();

    public QuestionGeneratorService(
            QuestionTemplateRepository templateRepository,
            ExamSessionStateRepository stateRepository
    ) {
        this.templateRepository = templateRepository;
        this.stateRepository = stateRepository;
    }

    /**
     * Generate all questions for a session.
     * Questions are randomized and stored for later retrieval.
     */
    @Transactional
    public ExamSessionState initializeSession(UUID sessionId, UUID examId) {
        // Check if already initialized
        Optional<ExamSessionState> existing = stateRepository.findBySessionId(sessionId);
        if (existing.isPresent()) {
            logger.info("Session {} already initialized", sessionId);
            return existing.get();
        }

        // Get all templates for this exam
        List<QuestionTemplate> templates = templateRepository.findByExamIdOrderByQuestionOrder(examId);
        if (templates.isEmpty()) {
            throw new IllegalStateException("No question templates found for exam: " + examId);
        }

        // Generate questions
        List<GeneratedQuestion> generatedQuestions = new ArrayList<>();
        GeneratedQuestion previousQuestion = null;
        String previousAnswer = null;

        for (int i = 0; i < templates.size(); i++) {
            QuestionTemplate template = templates.get(i);
            GeneratedQuestion generated = generateQuestion(template, i, previousQuestion, previousAnswer);
            generatedQuestions.add(generated);
            
            // Store for next question if it depends on previous
            previousQuestion = generated;
            previousAnswer = generated.getCorrectAnswer();
        }

        // Create session state
        ExamSessionState state = new ExamSessionState();
        state.setSessionId(sessionId);
        state.setGeneratedQuestions(generatedQuestions);
        state.setCurrentQuestionIndex(0);
        state.setCurrentQuestionStartedAt(Instant.now());

        state = stateRepository.save(state);
        logger.info("Initialized session {} with {} questions", sessionId, generatedQuestions.size());

        return state;
    }

    /**
     * Generate a single question from a template.
     */
    public GeneratedQuestion generateQuestion(
            QuestionTemplate template,
            int questionIndex,
            GeneratedQuestion previousQuestion,
            String previousAnswer
    ) {
        // Generate random values for parameters
        Map<String, Object> params = new HashMap<>();
        
        if (template.getParameters() != null) {
            for (Map.Entry<String, ParameterConfig> entry : template.getParameters().entrySet()) {
                String paramName = entry.getKey();
                ParameterConfig config = entry.getValue();
                Object value = generateParameterValue(config);
                params.put(paramName, value);
            }
        }

        // Add previous answer if this question depends on it
        if (Boolean.TRUE.equals(template.getDependsOnPrevious()) && previousAnswer != null) {
            try {
                // Try to parse as integer
                params.put("PREV_ANSWER", Integer.parseInt(previousAnswer));
            } catch (NumberFormatException e) {
                params.put("PREV_ANSWER", previousAnswer);
            }
        }

        // Generate text
        String generatedText = replacePlaceholders(template.getTemplateText(), params);

        // Generate options (for multiple choice)
        List<String> generatedOptions = null;
        if (template.getOptionsTemplate() != null && !template.getOptionsTemplate().isEmpty()) {
            generatedOptions = new ArrayList<>();
            for (String optionTemplate : template.getOptionsTemplate()) {
                String evaluatedOption = evaluateFormula(optionTemplate, params);
                generatedOptions.add(evaluatedOption);
            }
            // Shuffle options to randomize order
            Collections.shuffle(generatedOptions);
        }

        // Calculate correct answer
        String correctAnswer = evaluateFormula(template.getAnswerFormula(), params);

        // Build generated question
        GeneratedQuestion generated = new GeneratedQuestion();
        generated.setTemplateId(template.getId());
        generated.setQuestionIndex(questionIndex);
        generated.setGeneratedText(generatedText);
        generated.setType(template.getType().name());
        generated.setGeneratedOptions(generatedOptions);
        generated.setCorrectAnswer(correctAnswer);
        generated.setParams(params);
        generated.setTimeLimitSeconds(template.getTimeLimitSeconds());
        generated.setPoints(template.getPoints());
        generated.setDifficulty(template.getDifficulty().name());

        return generated;
    }

    /**
     * Generate a random value based on parameter config.
     */
    private Object generateParameterValue(ParameterConfig config) {
        if (config == null || config.getType() == null) {
            return 0;
        }

        switch (config.getType().toLowerCase()) {
            case "integer":
                int min = config.getMin() != null ? config.getMin() : 1;
                int max = config.getMax() != null ? config.getMax() : 100;
                return min + random.nextInt(max - min + 1);
                
            case "float":
                double fMin = config.getMin() != null ? config.getMin() : 1.0;
                double fMax = config.getMax() != null ? config.getMax() : 100.0;
                double value = fMin + random.nextDouble() * (fMax - fMin);
                return Math.round(value * 100.0) / 100.0; // 2 decimal places
                
            case "choice":
                if (config.getChoices() != null && !config.getChoices().isEmpty()) {
                    return config.getChoices().get(random.nextInt(config.getChoices().size()));
                }
                return "";
                
            default:
                return 0;
        }
    }

    /**
     * Replace placeholders like {{A}} with actual values.
     */
    private String replacePlaceholders(String template, Map<String, Object> params) {
        if (template == null) return "";
        
        StringBuffer result = new StringBuffer();
        Matcher matcher = PLACEHOLDER_PATTERN.matcher(template);
        
        while (matcher.find()) {
            String paramName = matcher.group(1);
            Object value = params.get(paramName);
            String replacement = value != null ? value.toString() : matcher.group(0);
            matcher.appendReplacement(result, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(result);
        
        return result.toString();
    }

    /**
     * Evaluate a formula with parameters.
     * Supports basic math operations.
     */
    public String evaluateFormula(String formula, Map<String, Object> params) {
        if (formula == null || formula.isEmpty()) {
            return "";
        }

        // First, replace all placeholders
        String replaced = replacePlaceholders(formula, params);

        // Check if it's a simple value (no operators)
        if (!containsOperators(replaced)) {
            return replaced;
        }

        // Evaluate as math expression
        try {
            ScriptEngineManager manager = new ScriptEngineManager();
            ScriptEngine engine = manager.getEngineByName("JavaScript");
            if (engine == null) {
                // Fallback: try to evaluate manually
                return evaluateSimpleMath(replaced);
            }
            Object result = engine.eval(replaced);
            
            // Format result
            if (result instanceof Double) {
                double d = (Double) result;
                if (d == Math.floor(d)) {
                    return String.valueOf((int) d);
                }
                return String.format("%.2f", d);
            }
            return result.toString();
        } catch (ScriptException e) {
            logger.warn("Failed to evaluate formula '{}': {}", formula, e.getMessage());
            return replaced;
        }
    }

    /**
     * Check if string contains math operators.
     */
    private boolean containsOperators(String s) {
        return s.contains("+") || s.contains("-") || s.contains("*") || s.contains("/");
    }

    /**
     * Simple math evaluation fallback.
     */
    private String evaluateSimpleMath(String expression) {
        try {
            // Handle simple operations: a + b, a - b, a * b, a / b
            String[] addParts = expression.split("\\+");
            if (addParts.length == 2) {
                int a = Integer.parseInt(addParts[0].trim());
                int b = Integer.parseInt(addParts[1].trim());
                return String.valueOf(a + b);
            }

            String[] subParts = expression.split("-");
            if (subParts.length == 2) {
                int a = Integer.parseInt(subParts[0].trim());
                int b = Integer.parseInt(subParts[1].trim());
                return String.valueOf(a - b);
            }

            String[] mulParts = expression.split("\\*");
            if (mulParts.length == 2) {
                int a = Integer.parseInt(mulParts[0].trim());
                int b = Integer.parseInt(mulParts[1].trim());
                return String.valueOf(a * b);
            }

            String[] divParts = expression.split("/");
            if (divParts.length == 2) {
                int a = Integer.parseInt(divParts[0].trim());
                int b = Integer.parseInt(divParts[1].trim());
                return String.valueOf(a / b);
            }
        } catch (NumberFormatException e) {
            // Not a simple math expression
        }
        return expression;
    }

    /**
     * Get the current question for a session (without correct answer).
     */
    public GeneratedQuestion getCurrentQuestion(UUID sessionId) {
        ExamSessionState state = stateRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        if (state.getIsLocked()) {
            throw new IllegalStateException("Session is locked: " + state.getLockReason());
        }

        if (state.getIsCompleted()) {
            throw new IllegalStateException("Exam is already completed");
        }

        return state.getCurrentQuestion();
    }
}

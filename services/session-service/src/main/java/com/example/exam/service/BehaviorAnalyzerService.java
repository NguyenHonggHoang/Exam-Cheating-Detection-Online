package com.example.exam.service;

import com.example.exam.config.RabbitMQConfig;
import com.example.exam.dto.BehaviorAnalysisDto;
import com.example.exam.dto.BehaviorAnalysisDto.*;
import com.example.exam.dto.IncidentEventDto;
import com.example.exam.model.ExamSessionState;
import com.example.exam.repository.ExamSessionStateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Behavior Analyzer Service
 * 
 * Analyzes answer behavior patterns to detect potential cheating:
 * - Latency spikes (abnormally long time on questions)
 * - Accuracy jumps (sudden improvement in correct answers)
 * - Revision patterns (many revisions then correct)
 * - Difficulty mismatches (easy questions taking longer than hard)
 * - Suspicious timing (too consistent timing = robotic)
 * 
 * Mirrors frontend AnswerBehaviorAnalyzer logic.
 * 
 * @deprecated As of 2025-12-26, behavior analysis is primarily handled by incident-service.
 * Frontend analysis is processed there directly.
 * This will be removed in a future version.
 */
@Deprecated
@Service
@Slf4j
@RequiredArgsConstructor
public class BehaviorAnalyzerService {

    private final ExamSessionStateRepository stateRepository;
    private final RabbitTemplate rabbitTemplate;

    // Thresholds (mirror frontend logic)
    private static final double LATENCY_SPIKE_RATIO = 2.5;
    private static final double ACCURACY_JUMP_THRESHOLD = 0.4;
    private static final int ACCURACY_WINDOW_SIZE = 5;
    private static final int HIGH_REVISION_COUNT = 3;
    private static final int REVISION_BEFORE_CORRECT = 2;
    private static final double CONSISTENT_TIME_CV = 0.15;

    // Risk thresholds
    private static final int HIGH_RISK_THRESHOLD = 70;
    private static final int MEDIUM_RISK_THRESHOLD = 40;

    /**
     * Process and store frontend behavior analysis
     */
    @Transactional
    public AnalysisResponse processFrontendAnalysis(FrontendAnalysisRequest request) {
        log.info("[BehaviorAnalyzer] Processing frontend analysis for session {}, score: {}", 
                request.sessionId(), request.overallScore());

        var stateOpt = stateRepository.findBySessionId(request.sessionId());
        if (stateOpt.isEmpty()) {
            log.warn("[BehaviorAnalyzer] Session state not found: {}", request.sessionId());
            return new AnalysisResponse(request.sessionId(), false, "Session not found");
        }

        var state = stateOpt.get();
        
        // Store analysis in session state
        state.setBehaviorScore(request.overallScore());
        state.setBehaviorAnomalies(serializeAnomalies(request.anomalies()));
        stateRepository.save(state);

        // Check if incident should be created
        boolean incidentCreated = false;
        if (request.overallScore() >= HIGH_RISK_THRESHOLD) {
            log.warn("[BehaviorAnalyzer] HIGH RISK session detected! Score: {}, Session: {}", 
                    request.overallScore(), request.sessionId());
            
            // FIX: Create incident via incident-service using RabbitMQ
            incidentCreated = sendBehaviorIncident(request);
            
        } else if (request.overallScore() >= MEDIUM_RISK_THRESHOLD) {
            log.info("[BehaviorAnalyzer] Medium risk session. Score: {}, Session: {}", 
                    request.overallScore(), request.sessionId());
        }

        // Log anomalies
        if (request.anomalies() != null && !request.anomalies().isEmpty()) {
            log.info("[BehaviorAnalyzer] {} anomalies detected:", request.anomalies().size());
            for (var anomaly : request.anomalies()) {
                log.info("  - [{}] {} (severity: {}, score: {})", 
                        anomaly.type(), anomaly.description(), anomaly.severity(), anomaly.score());
            }
        }

        String message = incidentCreated 
                ? "High risk behavior detected - incident created" 
                : "Analysis processed successfully";

        return new AnalysisResponse(request.sessionId(), incidentCreated, message);
    }

    /**
     * Send behavior analysis incident to incident-service via RabbitMQ
     */
    private boolean sendBehaviorIncident(FrontendAnalysisRequest request) {
        try {
            // Build reason from top anomalies
            String reason = buildIncidentReason(request.anomalies(), request.overallScore());
            
            IncidentEventDto event = IncidentEventDto.builder()
                    .sessionId(request.sessionId())
                    .type("BEHAVIOR_ANALYSIS")
                    .timestamp(Instant.now().toEpochMilli())
                    .score(BigDecimal.valueOf(request.overallScore() / 100.0))
                    .reason(reason)
                    .detectedBy("BEHAVIOR_ANALYZER")
                    .eventTime(Instant.now())
                    .build();
            
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.EXCHANGE_NAME,
                    RabbitMQConfig.INCIDENT_ROUTING_KEY,
                    event
            );
            
            log.info("[BehaviorAnalyzer] Incident event sent: sessionId={}, score={}", 
                    request.sessionId(), request.overallScore());
            return true;
            
        } catch (Exception ex) {
            log.error("[BehaviorAnalyzer] Failed to send incident event: sessionId={}, error={}", 
                    request.sessionId(), ex.getMessage(), ex);
            return false;
        }
    }

    /**
     * Build human-readable reason from anomalies
     */
    private String buildIncidentReason(List<BehaviorAnomaly> anomalies, int overallScore) {
        StringBuilder reason = new StringBuilder();
        reason.append(String.format("Behavior analysis score: %d/100. ", overallScore));
        
        if (anomalies != null && !anomalies.isEmpty()) {
            // Get top 3 highest score anomalies
            List<BehaviorAnomaly> topAnomalies = anomalies.stream()
                    .sorted((a, b) -> Integer.compare(b.score(), a.score()))
                    .limit(3)
                    .toList();
            
            reason.append("Top anomalies: ");
            for (int i = 0; i < topAnomalies.size(); i++) {
                if (i > 0) reason.append("; ");
                var a = topAnomalies.get(i);
                reason.append(String.format("[%s] %s", a.type(), a.description()));
            }
        }
        
        return reason.toString();
    }

    /**
     * Analyze session answers stored in database
     */
    public BehaviorAnalysisResult analyzeSession(UUID sessionId) {
        var stateOpt = stateRepository.findBySessionId(sessionId);
        if (stateOpt.isEmpty()) {
            return new BehaviorAnalysisResult(0, List.of(), null, List.of());
        }

        var state = stateOpt.get();
        var answers = state.getSubmittedAnswers();
        
        if (answers == null || answers.isEmpty()) {
            return new BehaviorAnalysisResult(0, List.of(), null, List.of());
        }

        List<BehaviorAnomaly> anomalies = new ArrayList<>();
        List<BehaviorPattern> patterns = new ArrayList<>();
        int overallScore = 0;

        // Calculate statistics
        var statistics = calculateStatistics(answers);

        // 1. Detect latency spikes
        var latencyAnomalies = detectLatencySpikes(answers, statistics);
        anomalies.addAll(latencyAnomalies);
        overallScore += latencyAnomalies.stream().mapToInt(BehaviorAnomaly::score).sum() * 0.25;

        // 2. Detect accuracy jumps
        var accuracyAnomalies = detectAccuracyJumps(answers);
        anomalies.addAll(accuracyAnomalies);
        overallScore += accuracyAnomalies.stream().mapToInt(BehaviorAnomaly::score).sum() * 0.25;

        // 3. Detect revision patterns
        var revisionAnomalies = detectRevisionPatterns(answers);
        anomalies.addAll(revisionAnomalies);
        overallScore += revisionAnomalies.stream().mapToInt(BehaviorAnomaly::score).sum() * 0.20;

        // 4. Detect difficulty mismatches
        var difficultyAnomalies = detectDifficultyMismatches(answers, statistics);
        anomalies.addAll(difficultyAnomalies);
        overallScore += difficultyAnomalies.stream().mapToInt(BehaviorAnomaly::score).sum() * 0.15;

        // 5. Detect timing patterns
        var timingPatterns = detectTimingPatterns(answers);
        patterns.addAll(timingPatterns);
        overallScore += timingPatterns.stream()
                .filter(BehaviorPattern::detected)
                .mapToDouble(p -> p.confidence() * 0.15)
                .sum();

        return new BehaviorAnalysisResult(
                Math.min(100, (int) Math.round(overallScore)),
                anomalies,
                statistics,
                patterns
        );
    }

    /**
     * Calculate answer statistics by difficulty
     */
    private AnswerStatistics calculateStatistics(List<ExamSessionState.SubmittedAnswer> answers) {
        int totalQuestions = answers.size();
        int correct = (int) answers.stream().filter(a -> Boolean.TRUE.equals(a.getIsCorrect())).count();
        double accuracy = totalQuestions > 0 ? (double) correct / totalQuestions : 0;

        Map<String, List<ExamSessionState.SubmittedAnswer>> byDifficulty = answers.stream()
                .filter(a -> a.getDifficulty() != null)
                .collect(Collectors.groupingBy(ExamSessionState.SubmittedAnswer::getDifficulty));

        Map<String, Double> avgTimePerDifficulty = new HashMap<>();
        Map<String, Double> avgRevisionsPerDifficulty = new HashMap<>();

        for (var entry : byDifficulty.entrySet()) {
            var diffAnswers = entry.getValue();
            double avgTime = diffAnswers.stream()
                    .filter(a -> a.getTimeSpentMs() != null)
                    .mapToLong(ExamSessionState.SubmittedAnswer::getTimeSpentMs)
                    .average()
                    .orElse(0);
            avgTimePerDifficulty.put(entry.getKey(), avgTime);

            double avgRevisions = diffAnswers.stream()
                    .filter(a -> a.getRevisionCount() != null)
                    .mapToInt(ExamSessionState.SubmittedAnswer::getRevisionCount)
                    .average()
                    .orElse(0);
            avgRevisionsPerDifficulty.put(entry.getKey(), avgRevisions);
        }

        return new AnswerStatistics(
                totalQuestions,
                totalQuestions,
                correct,
                accuracy,
                avgTimePerDifficulty,
                avgRevisionsPerDifficulty
        );
    }

    /**
     * Detect abnormal latency spikes
     */
    private List<BehaviorAnomaly> detectLatencySpikes(
            List<ExamSessionState.SubmittedAnswer> answers,
            AnswerStatistics stats) {
        
        List<BehaviorAnomaly> anomalies = new ArrayList<>();

        for (int i = 0; i < answers.size(); i++) {
            var answer = answers.get(i);
            if (answer.getTimeSpentMs() == null || answer.getDifficulty() == null) continue;

            Double avgTime = stats.avgTimePerDifficulty().get(answer.getDifficulty());
            if (avgTime == null || avgTime == 0) continue;

            double ratio = answer.getTimeSpentMs() / avgTime;

            if (ratio > LATENCY_SPIKE_RATIO) {
                String severity = "low";
                int score = 30;

                if (ratio > 4) {
                    severity = "high";
                    score = 70;
                } else if (ratio > 3) {
                    severity = "medium";
                    score = 50;
                }

                // Bonus for correct after long time (lookup behavior)
                if (Boolean.TRUE.equals(answer.getIsCorrect()) && ratio > 3) {
                    score += 20;
                }

                // Bonus for pre-suspicion during answer
                if (Boolean.TRUE.equals(answer.getHadPreSuspicionDuring())) {
                    score += 15;
                    severity = "low".equals(severity) ? "medium" : "high";
                }

                String description = String.format("Q%d: %.1fs (avg: %.1fs, %.1fx)",
                        i + 1, answer.getTimeSpentMs() / 1000.0, avgTime / 1000.0, ratio);

                anomalies.add(new BehaviorAnomaly(
                        "latency_spike",
                        severity,
                        Math.min(100, score),
                        description,
                        new AnomalyEvidence(i, avgTime, answer.getTimeSpentMs())
                ));
            }
        }

        return anomalies;
    }

    /**
     * Detect sudden accuracy improvements
     */
    private List<BehaviorAnomaly> detectAccuracyJumps(List<ExamSessionState.SubmittedAnswer> answers) {
        List<BehaviorAnomaly> anomalies = new ArrayList<>();

        if (answers.size() < ACCURACY_WINDOW_SIZE * 2) {
            return anomalies;
        }

        for (int i = ACCURACY_WINDOW_SIZE; i <= answers.size() - ACCURACY_WINDOW_SIZE; i++) {
            var beforeWindow = answers.subList(i - ACCURACY_WINDOW_SIZE, i);
            var afterWindow = answers.subList(i, i + ACCURACY_WINDOW_SIZE);

            double beforeAccuracy = beforeWindow.stream()
                    .filter(a -> Boolean.TRUE.equals(a.getIsCorrect()))
                    .count() / (double) ACCURACY_WINDOW_SIZE;
            double afterAccuracy = afterWindow.stream()
                    .filter(a -> Boolean.TRUE.equals(a.getIsCorrect()))
                    .count() / (double) ACCURACY_WINDOW_SIZE;

            double jump = afterAccuracy - beforeAccuracy;

            if (jump >= ACCURACY_JUMP_THRESHOLD) {
                // Check if pre-suspicion occurred around the jump point
                var aroundJump = answers.subList(Math.max(0, i - 1), Math.min(answers.size(), i + 1));
                boolean hadSuspicion = aroundJump.stream()
                        .anyMatch(a -> Boolean.TRUE.equals(a.getHadPreSuspicionDuring()));

                int score = (int) (jump * 100);
                String severity = "medium";

                if (hadSuspicion) {
                    score += 25;
                    severity = "high";
                }

                if (jump >= 0.6) {
                    severity = "high";
                    score = Math.min(100, score + 20);
                }

                String description = String.format("Accuracy jump from %.0f%% → %.0f%% at Q%d",
                        beforeAccuracy * 100, afterAccuracy * 100, i + 1);

                anomalies.add(new BehaviorAnomaly(
                        "accuracy_jump",
                        severity,
                        Math.min(100, score),
                        description,
                        new AnomalyEvidence(i, beforeAccuracy, afterAccuracy)
                ));
            }
        }

        return anomalies;
    }

    /**
     * Detect suspicious revision patterns
     */
    private List<BehaviorAnomaly> detectRevisionPatterns(List<ExamSessionState.SubmittedAnswer> answers) {
        List<BehaviorAnomaly> anomalies = new ArrayList<>();

        for (int i = 0; i < answers.size(); i++) {
            var answer = answers.get(i);
            if (answer.getRevisionCount() == null) continue;

            // Pattern: Many revisions then correct (lookup behavior)
            if (answer.getRevisionCount() >= REVISION_BEFORE_CORRECT 
                    && Boolean.TRUE.equals(answer.getIsCorrect())) {
                
                String severity = "medium";
                int score = 40 + (answer.getRevisionCount() * 10);

                if (Boolean.TRUE.equals(answer.getHadPreSuspicionDuring())) {
                    score += 20;
                    severity = "high";
                }

                if (answer.getRevisionCount() >= HIGH_REVISION_COUNT) {
                    severity = "high";
                    score += 15;
                }

                String description = String.format("Q%d: %d revisions → correct",
                        i + 1, answer.getRevisionCount());

                anomalies.add(new BehaviorAnomaly(
                        "revision_pattern",
                        severity,
                        Math.min(100, score),
                        description,
                        new AnomalyEvidence(i, 1, answer.getRevisionCount())
                ));
            }
        }

        return anomalies;
    }

    /**
     * Detect difficulty-time mismatches
     */
    private List<BehaviorAnomaly> detectDifficultyMismatches(
            List<ExamSessionState.SubmittedAnswer> answers,
            AnswerStatistics stats) {
        
        List<BehaviorAnomaly> anomalies = new ArrayList<>();

        Double easyAvg = stats.avgTimePerDifficulty().get("easy");
        Double hardAvg = stats.avgTimePerDifficulty().get("hard");

        // If hard questions aren't taking longer than easy ones = suspicious
        if (easyAvg != null && hardAvg != null && easyAvg > 0 && hardAvg > 0) {
            double ratio = hardAvg / easyAvg;
            if (ratio < 1.2) {
                anomalies.add(new BehaviorAnomaly(
                        "difficulty_mismatch",
                        "medium",
                        50,
                        String.format("Hard questions not taking longer than easy (ratio: %.2f)", ratio),
                        new AnomalyEvidence(-1, 1.5, ratio)
                ));
            }
        }

        // Individual easy questions taking too long
        for (int i = 0; i < answers.size(); i++) {
            var answer = answers.get(i);
            if (answer.getTimeSpentMs() == null || answer.getDifficulty() == null) continue;

            if ("easy".equals(answer.getDifficulty()) && hardAvg != null && hardAvg > 0) {
                if (answer.getTimeSpentMs() > hardAvg) {
                    String description = String.format("Q%d (easy) took %.1fs > avg hard question",
                            i + 1, answer.getTimeSpentMs() / 1000.0);

                    anomalies.add(new BehaviorAnomaly(
                            "difficulty_mismatch",
                            "low",
                            30,
                            description,
                            new AnomalyEvidence(i, easyAvg, answer.getTimeSpentMs())
                    ));
                }
            }
        }

        return anomalies;
    }

    /**
     * Detect suspicious timing patterns
     */
    private List<BehaviorPattern> detectTimingPatterns(List<ExamSessionState.SubmittedAnswer> answers) {
        List<BehaviorPattern> patterns = new ArrayList<>();

        List<Long> times = answers.stream()
                .filter(a -> a.getTimeSpentMs() != null)
                .map(ExamSessionState.SubmittedAnswer::getTimeSpentMs)
                .toList();

        if (times.size() < 5) {
            return patterns;
        }

        // Check for too-consistent timing (robotic behavior)
        double mean = times.stream().mapToLong(Long::longValue).average().orElse(0);
        double variance = times.stream()
                .mapToDouble(t -> Math.pow(t - mean, 2))
                .average()
                .orElse(0);
        double cv = Math.sqrt(variance) / mean; // Coefficient of variation

        boolean isTooConsistent = cv < CONSISTENT_TIME_CV;
        double confidence = isTooConsistent ? (1 - cv / CONSISTENT_TIME_CV) * 100 : 0;

        patterns.add(new BehaviorPattern(
                "consistent_timing",
                isTooConsistent,
                confidence,
                isTooConsistent
                        ? String.format("Answer timing too consistent (CV=%.3f)", cv)
                        : "Normal answer timing variation"
        ));

        // Check for pre-suspicion → correct pattern
        long suspicionCorrectCount = answers.stream()
                .filter(a -> Boolean.TRUE.equals(a.getHadPreSuspicionDuring()) 
                        && Boolean.TRUE.equals(a.getIsCorrect()))
                .count();
        long suspicionCount = answers.stream()
                .filter(a -> Boolean.TRUE.equals(a.getHadPreSuspicionDuring()))
                .count();
        double suspicionRatio = suspicionCount > 0 ? (double) suspicionCorrectCount / suspicionCount : 0;

        boolean isSuspiciousCorrelation = suspicionRatio > 0.7 && suspicionCorrectCount >= 3;

        patterns.add(new BehaviorPattern(
                "suspicion_correct_correlation",
                isSuspiciousCorrelation,
                isSuspiciousCorrelation ? suspicionRatio * 100 : 0,
                isSuspiciousCorrelation
                        ? String.format("%d questions with suspicion → correct (%.0f%%)", 
                                suspicionCorrectCount, suspicionRatio * 100)
                        : "No suspicion-correct correlation"
        ));

        return patterns;
    }

    /**
     * Serialize anomalies to JSON string for storage
     */
    private String serializeAnomalies(List<BehaviorAnomaly> anomalies) {
        if (anomalies == null || anomalies.isEmpty()) {
            return "[]";
        }
        // Simple JSON serialization
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < anomalies.size(); i++) {
            var a = anomalies.get(i);
            if (i > 0) sb.append(",");
            sb.append(String.format("{\"type\":\"%s\",\"severity\":\"%s\",\"score\":%d,\"description\":\"%s\"}",
                    a.type(), a.severity(), a.score(), a.description().replace("\"", "\\\"")
            ));
        }
        sb.append("]");
        return sb.toString();
    }
}

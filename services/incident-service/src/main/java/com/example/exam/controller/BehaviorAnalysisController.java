package com.example.exam.controller;

import com.example.exam.dto.BehaviorAnalysisRequest;
import com.example.exam.dto.BehaviorAnalysisResponse;
import com.example.exam.model.BehaviorAnalysis;
import com.example.exam.repository.BehaviorAnalysisRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/behavior")
@RequiredArgsConstructor
@Slf4j
public class BehaviorAnalysisController {
    
    private final BehaviorAnalysisRepository behaviorAnalysisRepository;
    private final ObjectMapper objectMapper;
    
    /**
     * Submit behavior analysis results from frontend
     */
    @PostMapping("/submit")
    public ResponseEntity<BehaviorAnalysisResponse> submitAnalysis(
            @RequestBody BehaviorAnalysisRequest request
    ) {
        try {
            log.info("[BehaviorAnalysis] Received analysis for session: {}, score: {}",
                    request.getSessionId(), request.getOverallScore());
            
            UUID sessionId = UUID.fromString(request.getSessionId());
            
            // Convert to JSON strings
            String anomaliesJson = objectMapper.writeValueAsString(request.getAnomalies());
            String statisticsJson = objectMapper.writeValueAsString(request.getStatistics());
            String patternsJson = objectMapper.writeValueAsString(request.getPatterns());
            
            // Create and save analysis
            BehaviorAnalysis analysis = new BehaviorAnalysis();
            analysis.setId(UUID.randomUUID());
            analysis.setSessionId(sessionId);
            analysis.setExamId(sessionId); // TODO: Get actual examId from session
            analysis.setOverallScore(request.getOverallScore());
            analysis.setAnomaliesJson(anomaliesJson);
            analysis.setStatisticsJson(statisticsJson);
            analysis.setPatternsJson(patternsJson);
            analysis.setAnalyzedAt(Instant.now());
            
            behaviorAnalysisRepository.save(analysis);
            
            // Determine if incident should be created (high risk)
            boolean incidentCreated = request.getOverallScore() != null && request.getOverallScore() >= 70;
            
            log.info("[BehaviorAnalysis] Saved analysis: id={}, incident={}", 
                    analysis.getId(), incidentCreated);
            
            return ResponseEntity.ok(BehaviorAnalysisResponse.builder()
                    .message("Analysis saved successfully")
                    .analysisId(analysis.getId().toString())
                    .incidentCreated(incidentCreated)
                    .riskScore(request.getOverallScore())
                    .build());
                    
        } catch (Exception e) {
            log.error("[BehaviorAnalysis] Failed to save analysis: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(BehaviorAnalysisResponse.builder()
                            .message("Failed to save analysis: " + e.getMessage())
                            .build());
        }
    }
    
    /**
     * Get behavior analysis by session ID
     */
    @GetMapping("/session/{sessionId}")
    public ResponseEntity<?> getAnalysisBySession(@PathVariable String sessionId) {
        try {
            UUID id = UUID.fromString(sessionId);
            return behaviorAnalysisRepository.findBySessionId(id)
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            log.error("[BehaviorAnalysis] Failed to get analysis: {}", e.getMessage());
            return ResponseEntity.badRequest().body("Invalid session ID");
        }
    }
    
    /**
     * Get all high-risk analyses (score >= threshold)
     */
    @GetMapping("/high-risk")
    public ResponseEntity<?> getHighRiskAnalyses(
            @RequestParam(defaultValue = "70") Float threshold
    ) {
        try {
            var analyses = behaviorAnalysisRepository.findByOverallScoreGreaterThanEqual(threshold);
            return ResponseEntity.ok(analyses);
        } catch (Exception e) {
            log.error("[BehaviorAnalysis] Failed to get high-risk analyses: {}", e.getMessage());
            return ResponseEntity.badRequest().body("Failed to fetch analyses");
        }
    }
}

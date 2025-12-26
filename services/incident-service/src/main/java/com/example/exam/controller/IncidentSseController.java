package com.example.exam.controller;

import com.example.exam.service.SseEmitterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

/**
 * SSE Controller for Real-time Incident Notifications
 * 
 * Provides Server-Sent Events endpoints for proctors to receive
 * instant notifications when new violations are detected.
 */
@RestController
@RequestMapping("/api/incidents")
@Tag(name = "SSE", description = "Server-Sent Events for real-time notifications")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:3000"}, allowCredentials = "true")
@Slf4j
public class IncidentSseController {

    private final SseEmitterService sseEmitterService;

    /**
     * Subscribe to real-time incident notifications
     * 
     * Usage:
     * const es = new EventSource('/api/incidents/stream');
     * es.addEventListener('new-incident', (e) => console.log(JSON.parse(e.data)));
     * 
     * @return SSE stream with incident events
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Subscribe to real-time incident notifications")
    public SseEmitter streamIncidents(@RequestHeader(value = "X-User-Id", required = false) String userId) {
        // Use userId or generate random ID
        String proctorId = userId != null ? userId : "proctor_" + UUID.randomUUID().toString().substring(0, 8);
        
        log.info("New SSE subscription request from: {}", proctorId);
        
        return sseEmitterService.createEmitter(proctorId);
    }

    /**
     * Subscribe to incidents for a specific exam
     * 
     * @param examId Exam ID to filter incidents
     * @return SSE stream with exam-specific incidents
     */
    @GetMapping(value = "/stream/exam/{examId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Subscribe to incidents for specific exam")
    public SseEmitter streamExamIncidents(
            @PathVariable String examId,
            @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String proctorId = userId != null ? userId : "proctor_" + UUID.randomUUID().toString().substring(0, 8);
        
        log.info("New SSE subscription for exam {} from: {}", examId, proctorId);
        
        return sseEmitterService.createEmitterForExam(proctorId, examId);
    }

    /**
     * Get current connection count (for monitoring)
     */
    @GetMapping("/stream/status")
    @Operation(summary = "Get SSE connection status")
    public java.util.Map<String, Object> getStreamStatus() {
        return java.util.Map.of(
            "activeConnections", sseEmitterService.getConnectionCount(),
            "timestamp", System.currentTimeMillis()
        );
    }
}

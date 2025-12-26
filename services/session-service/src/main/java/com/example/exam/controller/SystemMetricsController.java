package com.example.exam.controller;

import com.example.exam.repository.ExamRepository;
import com.example.exam.repository.SessionRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.util.Map;
import java.lang.management.ManagementFactory;
import java.time.Duration;

@RestController
@RequestMapping("/api/admin")
public class SystemMetricsController {

    private final SessionRepository sessionRepository;
    private final ExamRepository examRepository;
    // Injecting DataSource to check connections if possible
    
    public SystemMetricsController(SessionRepository sessionRepository, ExamRepository examRepository) {
        this.sessionRepository = sessionRepository;
        this.examRepository = examRepository;
    }

    @GetMapping("/metrics")
    public ResponseEntity<SystemMetrics> getMetrics() {
        long activeSessions = sessionRepository.count(); // Approximate active, need status filter
        long totalExams = examRepository.count();
        long activeExams = 0; // count by status
        long pendingIncidents = 0; // need incident repo or client

        long uptimeMillis = ManagementFactory.getRuntimeMXBean().getUptime();
        String uptime = formatDuration(Duration.ofMillis(uptimeMillis));

        // Mock storage/db until real impl
        return ResponseEntity.ok(new SystemMetrics(
            (int) activeSessions,
            totalExams,
            activeExams,
            pendingIncidents,
            "1.2 GB", "10 GB", 12,
            5, 100,
            uptime
        ));
    }
    
    @GetMapping("/health")
    public ResponseEntity<Object> getHealth() {
       return ResponseEntity.ok(Map.of(
           "name", "session-service",
           "status", "UP"
       )); 
       // AdminSystemPage expects list of services. Frontend mocks it for now.
       // Only dashboard stats utilize this? No, dashboard uses examsApi.getAll
       // AdminSystemPage calls /api/admin/metrics
    }

    private String formatDuration(Duration duration) {
        long days = duration.toDays();
        long hours = duration.toHoursPart();
        long minutes = duration.toMinutesPart();
        return String.format("%d ngày %d giờ %d phút", days, hours, minutes);
    }
}

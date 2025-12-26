package com.example.exam.controller;

import com.example.exam.dto.ExamDto;
import com.example.exam.service.ExamService;
import com.example.exam.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * @deprecated As of 2025-12-26, exam management is now handled through MockExamController.
 * Queue management features are not currently in use.
 * This will be removed in a future version.
 */
@Deprecated
@RestController
@RequestMapping("/api/exams")
@Tag(name = "Exams", description = "Exam management endpoints")
public class ExamController {

    private final ExamService examService;
    
    // Queue tracking - stores actual members, not just count
    // examId -> Map<userId, QueueMember>
    private final Map<UUID, Map<String, QueueMember>> examQueueMembers = new ConcurrentHashMap<>();
    private final Map<UUID, Boolean> examStarted = new ConcurrentHashMap<>();
    
    // Simple queue member record
    record QueueMember(String id, String odKeys, Instant joinedAt) {
        Map<String, Object> toMap() {
            return Map.of(
                "id", id,
                "userId",  id,
                "joinedAt", joinedAt.toString()
            );
        }
    }

    public ExamController(ExamService examService) {
        this.examService = examService;
    }

    @GetMapping
    @Operation(summary = "Get all exams", description = "Retrieve all exams, optionally filtered by status (ACTIVE, ENDED, UPCOMING, SCHEDULED)")
    public ResponseEntity<List<ExamDto.Response>> getAllExams(
            @RequestParam(required = false) String status
    ) {
        List<ExamDto.Response> exams = examService.getAllExams(status);
        return ResponseEntity.ok(exams);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get exam by ID", description = "Retrieve a single exam by its ID")
    public ResponseEntity<ExamDto.Response> getExamById(@PathVariable UUID id) {
        ExamDto.Response exam = examService.getExamById(id);
        return ResponseEntity.ok(exam);
    }

    @PostMapping
    @Operation(summary = "Create new exam", description = "Create a new exam")
    public ResponseEntity<ExamDto.Response> createExam(@Valid @RequestBody ExamDto.CreateRequest request) {
        ExamDto.Response exam = examService.createExam(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(exam);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update exam", description = "Update an existing exam")
    public ResponseEntity<ExamDto.Response> updateExam(
            @PathVariable UUID id,
            @Valid @RequestBody ExamDto.UpdateRequest request
    ) {
        ExamDto.Response exam = examService.updateExam(id, request);
        return ResponseEntity.ok(exam);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete exam", description = "Delete an exam by ID")
    public ResponseEntity<Void> deleteExam(@PathVariable UUID id) {
        examService.deleteExam(id);
        return ResponseEntity.noContent().build();
    }
    
    // ========== Queue Management ==========
    
    @PostMapping("/{id}/queue/join")
    @Operation(summary = "Join exam queue", description = "Student joins the waiting queue for an exam")
    public ResponseEntity<Map<String, Object>> joinQueue(@PathVariable UUID id) {
        String userId = SecurityUtils.getCurrentUserId();
        
        examQueueMembers.putIfAbsent(id, new ConcurrentHashMap<>());
        Map<String, QueueMember> members = examQueueMembers.get(id);
        
        // Add or update member
        members.putIfAbsent(userId, new QueueMember(userId, userId, Instant.now()));
        
        // Calculate position (order by join time)
        int position = new ArrayList<>(members.keySet()).indexOf(userId) + 1;
        
        return ResponseEntity.ok(Map.of(
            "examId", id,
            "userId", userId,
            "position", position,
            "totalInQueue", members.size(),
            "examStarted", examStarted.getOrDefault(id, false)
        ));
    }
    
    @PostMapping("/{id}/queue/leave")
    @Operation(summary = "Leave exam queue", description = "Student leaves the waiting queue")
    public ResponseEntity<Void> leaveQueue(@PathVariable UUID id) {
        String userId = SecurityUtils.getCurrentUserId();
        
        Map<String, QueueMember> members = examQueueMembers.get(id);
        if (members != null) {
            members.remove(userId);
        }
        return ResponseEntity.ok().build();
    }
    
    @GetMapping("/{id}/queue/status")
    @Operation(summary = "Get queue status", description = "Get current queue status for an exam")
    public ResponseEntity<Map<String, Object>> getQueueStatus(@PathVariable UUID id) {
        Map<String, QueueMember> members = examQueueMembers.getOrDefault(id, new ConcurrentHashMap<>());
        boolean started = examStarted.getOrDefault(id, false);
        
        return ResponseEntity.ok(Map.of(
            "examId", id,
            "totalInQueue", members.size(),
            "examStarted", started
        ));
    }
    
    @GetMapping("/{id}/queue/members")
    @Operation(summary = "Get queue members", description = "Get list of students in waiting queue (for proctor)")
    public ResponseEntity<Map<String, Object>> getQueueMembers(@PathVariable UUID id) {
        Map<String, QueueMember> members = examQueueMembers.getOrDefault(id, new ConcurrentHashMap<>());
        boolean started = examStarted.getOrDefault(id, false);
        
        List<Map<String, Object>> memberList = members.values().stream()
            .sorted(Comparator.comparing(QueueMember::joinedAt))
            .map(QueueMember::toMap)
            .toList();
        
        return ResponseEntity.ok(Map.of(
            "examId", id,
            "members", memberList,
            "totalInQueue", members.size(),
            "examStarted", started
        ));
    }
    
    @PostMapping("/{id}/start")
    @Operation(summary = "Start exam", description = "Proctor starts the exam, allowing students to proceed")
    public ResponseEntity<Map<String, Object>> startExam(@PathVariable UUID id) {
        examStarted.put(id, true);
        int queueSize = examQueueMembers.getOrDefault(id, new ConcurrentHashMap<>()).size();
        
        // TODO: Send WebSocket notification to all waiting students
        
        return ResponseEntity.ok(Map.of(
            "examId", id,
            "started", true,
            "studentsNotified", queueSize
        ));
    }
}

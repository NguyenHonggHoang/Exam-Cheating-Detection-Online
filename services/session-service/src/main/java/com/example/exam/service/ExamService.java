package com.example.exam.service;

import com.example.exam.dto.ExamDto;
import com.example.exam.model.Exam;
import com.example.exam.repository.ExamRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ExamService {

    private static final Logger log = LoggerFactory.getLogger(ExamService.class);
    private final ExamRepository examRepository;

    public ExamService(ExamRepository examRepository) {
        this.examRepository = examRepository;
    }

    /**
     * Get all exams, optionally filtered by status
     */
    @Transactional(readOnly = true)
    public List<ExamDto.Response> getAllExams(String status) {
        List<Exam> exams = examRepository.findAll();
        
        return exams.stream()
                .map(this::toResponse)
                .filter(e -> status == null || status.isBlank() || status.equalsIgnoreCase(e.status))
                .collect(Collectors.toList());
    }

    /**
     * Get exam by ID
     */
    @Transactional(readOnly = true)
    public ExamDto.Response getExamById(UUID id) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + id));
        return toResponse(exam);
    }

    /**
     * Create new exam
     */
    @Transactional
    public ExamDto.Response createExam(ExamDto.CreateRequest request) {
        log.info("Creating new exam: {}", request.name);
        
        Exam exam = new Exam();
        exam.setName(request.name);
        exam.setDescription(request.description);
        exam.setStartTime(request.startTime);
        exam.setEndTime(request.endTime);
        exam.setRetentionDays(request.retentionDays != null ? request.retentionDays : 30);
        exam.setCreatedBy(com.example.exam.util.SecurityUtils.getCurrentUserId());
        exam.setCreatedAt(Instant.now());
        exam.setUpdatedAt(Instant.now());
        
        Exam saved = examRepository.save(exam);
        log.info("Created exam with ID: {}", saved.getId());
        
        return toResponse(saved);
    }

    /**
     * Update existing exam
     */
    @Transactional
    public ExamDto.Response updateExam(UUID id, ExamDto.UpdateRequest request) {
        log.info("Updating exam: {}", id);
        
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + id));
        
        if (request.name != null) exam.setName(request.name);
        if (request.description != null) exam.setDescription(request.description);
        if (request.startTime != null) exam.setStartTime(request.startTime);
        if (request.endTime != null) exam.setEndTime(request.endTime);
        if (request.retentionDays != null) exam.setRetentionDays(request.retentionDays);
        exam.setUpdatedAt(Instant.now());
        
        Exam saved = examRepository.save(exam);
        log.info("Updated exam: {}", id);
        
        return toResponse(saved);
    }

    /**
     * Delete exam
     */
    @Transactional
    public void deleteExam(UUID id) {
        log.info("Deleting exam: {}", id);
        if (!examRepository.existsById(id)) {
            throw new IllegalArgumentException("Exam not found: " + id);
        }
        examRepository.deleteById(id);
        log.info("Deleted exam: {}", id);
    }

    /**
     * Convert Exam entity to Response DTO
     */
    private ExamDto.Response toResponse(Exam exam) {
        return new ExamDto.Response(
                exam.getId(),
                exam.getName(),
                exam.getDescription(),
                exam.getStartTime(),
                exam.getEndTime(),
                exam.getRetentionDays(),
                exam.getCreatedBy(),
                exam.getCreatedAt(),
                exam.getUpdatedAt()
        );
    }
}

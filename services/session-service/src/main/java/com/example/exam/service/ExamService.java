package com.example.exam.service;

import com.example.exam.dto.ExamDto;
import com.example.exam.model.Exam;
import com.example.exam.model.Exam.BrowserMode;
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
        exam.setDurationMinutes(request.durationMinutes);
        exam.setRetentionDays(request.retentionDays != null ? request.retentionDays : 30);
        
        BrowserMode browserMode = parseBrowserMode(request.browserMode);
        exam.setBrowserMode(browserMode);
        
        if (browserMode != BrowserMode.NORMAL) {
            exam.setSebConfigKey(ExamDto.generateSebConfigKey());
        }

        if (request.sebConfig != null) {
            Exam.SebConfig config = new Exam.SebConfig();
            config.setQuitPassword(request.sebConfig.quitPassword);
            config.setAdminPassword(request.sebConfig.adminPassword);
            config.setAllowWifi(request.sebConfig.allowWifi);
            config.setShowTaskBar(request.sebConfig.showTaskBar);
            config.setShowReloadButton(request.sebConfig.showReloadButton);
            config.setShowTime(request.sebConfig.showTime);
            config.setShowInputLanguage(request.sebConfig.showInputLanguage);
            config.setAllowQuit(request.sebConfig.allowQuit);
            config.setDetectVirtualMachine(request.sebConfig.detectVirtualMachine);
            config.setAllowRemoteDesktop(request.sebConfig.allowRemoteDesktop);
            config.setAllowMultipleDisplays(request.sebConfig.allowMultipleDisplays);
            config.setAllowDisplayMirroring(request.sebConfig.allowDisplayMirroring);
            config.setBlockScreenCapture(request.sebConfig.blockScreenCapture);
            config.setEnableKioskMode(request.sebConfig.enableKioskMode);
            config.setEnablePrivateClipboard(request.sebConfig.enablePrivateClipboard);
            config.setUrlFilterRules(request.sebConfig.urlFilterRules);
            config.setProhibitedProcesses(request.sebConfig.prohibitedProcesses);
            exam.setSebConfig(config);
        }
        
        exam.setRequireIdVerification(request.requireIdVerification != null ? request.requireIdVerification : true);
        exam.setMaxVerificationAttempts(request.maxVerificationAttempts != null ? request.maxVerificationAttempts : 5);
        exam.setMaxAttempts(request.maxAttempts);  // null = unlimited
        
        exam.setCreatedBy(com.example.exam.util.SecurityUtils.getCurrentUserId());
        exam.setCreatedAt(Instant.now());
        exam.setUpdatedAt(Instant.now());
        
        Exam saved = examRepository.save(exam);
        log.info("Created exam with ID: {}, browserMode: {}, maxAttempts: {}", saved.getId(), browserMode, request.maxAttempts);
        
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
        if (request.durationMinutes != null) exam.setDurationMinutes(request.durationMinutes);
        if (request.retentionDays != null) exam.setRetentionDays(request.retentionDays);
        
        // Update SEB Configuration
        if (request.browserMode != null) {
            BrowserMode newMode = parseBrowserMode(request.browserMode);
            exam.setBrowserMode(newMode);
            
            // Generate SEB key if switching to SEB mode and no key exists
            if (newMode != BrowserMode.NORMAL && exam.getSebConfigKey() == null) {
                exam.setSebConfigKey(ExamDto.generateSebConfigKey());
            }
            if (newMode != BrowserMode.NORMAL && exam.getSebConfigKey() == null) {
                exam.setSebConfigKey(ExamDto.generateSebConfigKey());
            }
        }
        
        if (request.sebConfig != null) {
            Exam.SebConfig config = exam.getSebConfig();
            if (config == null) config = new Exam.SebConfig();
            
            // Basic settings
            if (request.sebConfig.quitPassword != null) config.setQuitPassword(request.sebConfig.quitPassword);
            if (request.sebConfig.adminPassword != null) config.setAdminPassword(request.sebConfig.adminPassword);
            if (request.sebConfig.allowWifi != null) config.setAllowWifi(request.sebConfig.allowWifi);
            if (request.sebConfig.showTaskBar != null) config.setShowTaskBar(request.sebConfig.showTaskBar);
            if (request.sebConfig.showReloadButton != null) config.setShowReloadButton(request.sebConfig.showReloadButton);
            if (request.sebConfig.showTime != null) config.setShowTime(request.sebConfig.showTime);
            if (request.sebConfig.showInputLanguage != null) config.setShowInputLanguage(request.sebConfig.showInputLanguage);
            if (request.sebConfig.allowQuit != null) config.setAllowQuit(request.sebConfig.allowQuit);
            // Security settings
            if (request.sebConfig.detectVirtualMachine != null) config.setDetectVirtualMachine(request.sebConfig.detectVirtualMachine);
            if (request.sebConfig.allowRemoteDesktop != null) config.setAllowRemoteDesktop(request.sebConfig.allowRemoteDesktop);
            if (request.sebConfig.allowMultipleDisplays != null) config.setAllowMultipleDisplays(request.sebConfig.allowMultipleDisplays);
            if (request.sebConfig.allowDisplayMirroring != null) config.setAllowDisplayMirroring(request.sebConfig.allowDisplayMirroring);
            if (request.sebConfig.blockScreenCapture != null) config.setBlockScreenCapture(request.sebConfig.blockScreenCapture);
            if (request.sebConfig.enableKioskMode != null) config.setEnableKioskMode(request.sebConfig.enableKioskMode);
            if (request.sebConfig.enablePrivateClipboard != null) config.setEnablePrivateClipboard(request.sebConfig.enablePrivateClipboard);
            if (request.sebConfig.urlFilterRules != null) config.setUrlFilterRules(request.sebConfig.urlFilterRules);
            if (request.sebConfig.prohibitedProcesses != null) config.setProhibitedProcesses(request.sebConfig.prohibitedProcesses);
            
            exam.setSebConfig(config);
        }
        if (request.requireIdVerification != null) exam.setRequireIdVerification(request.requireIdVerification);
        if (request.maxVerificationAttempts != null) exam.setMaxVerificationAttempts(request.maxVerificationAttempts);
        // maxAttempts can be explicitly set to null (unlimited) or a number
        exam.setMaxAttempts(request.maxAttempts);
        
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
     * Parse browser mode from string
     */
    private BrowserMode parseBrowserMode(String mode) {
        if (mode == null || mode.isBlank()) {
            return BrowserMode.NORMAL;
        }
        try {
            return BrowserMode.valueOf(mode.toUpperCase());
        } catch (IllegalArgumentException e) {
            log.warn("Invalid browser mode: {}, defaulting to NORMAL", mode);
            return BrowserMode.NORMAL;
        }
    }

    /**
     * Convert Exam entity to Response DTO
     */
    private ExamDto.Response toResponse(Exam exam) {
        ExamDto.SebConfigDto sebConfigDto = null;
        if (exam.getSebConfig() != null) {
            Exam.SebConfig c = exam.getSebConfig();
            sebConfigDto = new ExamDto.SebConfigDto(
                c.getQuitPassword(),
                c.getAdminPassword(),
                c.getAllowWifi(),
                c.getShowTaskBar(),
                c.getShowReloadButton(),
                c.getShowTime(),
                c.getShowInputLanguage(),
                c.getAllowQuit()
            );
            sebConfigDto.detectVirtualMachine = c.getDetectVirtualMachine();
            sebConfigDto.allowRemoteDesktop = c.getAllowRemoteDesktop();
            sebConfigDto.allowMultipleDisplays = c.getAllowMultipleDisplays();
            sebConfigDto.allowDisplayMirroring = c.getAllowDisplayMirroring();
            sebConfigDto.blockScreenCapture = c.getBlockScreenCapture();
            sebConfigDto.enableKioskMode = c.getEnableKioskMode();
            sebConfigDto.enablePrivateClipboard = c.getEnablePrivateClipboard();
            sebConfigDto.urlFilterRules = c.getUrlFilterRules();
            sebConfigDto.prohibitedProcesses = c.getProhibitedProcesses();
        }

        ExamDto.Response response = new ExamDto.Response(
                exam.getId(),
                exam.getName(),
                exam.getDescription(),
                exam.getStartTime(),
                exam.getEndTime(),
                exam.getDurationMinutes(),
                exam.getRetentionDays(),
                exam.getCreatedBy(),
                exam.getCreatedAt(),
                exam.getUpdatedAt(),
                exam.getBrowserMode(),
                sebConfigDto,
                exam.getSebConfigKey(),
                exam.getRequireIdVerification(),
                exam.getMaxVerificationAttempts()
        );
        response.maxAttempts = exam.getMaxAttempts();
        return response;
    }
}


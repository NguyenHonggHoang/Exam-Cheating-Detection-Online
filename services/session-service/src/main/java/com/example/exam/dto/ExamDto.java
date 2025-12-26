package com.example.exam.dto;

import com.example.exam.model.Exam.BrowserMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

public class ExamDto {

    public static class SebConfigDto {
        // Basic settings
        public String quitPassword;
        public String adminPassword;
        public Boolean allowWifi;
        public Boolean showTaskBar;
        public Boolean showReloadButton;
        public Boolean showTime;
        public Boolean showInputLanguage;
        public Boolean allowQuit;
        
        // Security settings
        public Boolean detectVirtualMachine;
        public Boolean allowRemoteDesktop;
        public Boolean allowMultipleDisplays;
        public Boolean allowDisplayMirroring;
        public Boolean blockScreenCapture;
        public Boolean enableKioskMode;
        public Boolean enablePrivateClipboard;
        public String urlFilterRules;
        public String prohibitedProcesses;
        
        public SebConfigDto() {}
        
        public SebConfigDto(String quitPassword, String adminPassword, Boolean allowWifi, 
                           Boolean showTaskBar, Boolean showReloadButton, Boolean showTime,
                           Boolean showInputLanguage, Boolean allowQuit) {
            this.quitPassword = quitPassword;
            this.adminPassword = adminPassword;
            this.allowWifi = allowWifi;
            this.showTaskBar = showTaskBar;
            this.showReloadButton = showReloadButton;
            this.showTime = showTime;
            this.showInputLanguage = showInputLanguage;
            this.allowQuit = allowQuit;
        }
    }

    public static class Response {
        public UUID id;
        public String name;
        public String description;
        public Instant startTime;
        public Instant endTime;
        public Integer durationMinutes;
        public Integer retentionDays;
        public String createdBy;
        public Instant createdAt;
        public Instant updatedAt;
        public String status; // ACTIVE, ENDED, UPCOMING
        
        // SEB Configuration
        public String browserMode; // NORMAL, SEB_REQUIRED, SEB_OPTIONAL
        public SebConfigDto sebConfig;
        public String sebConfigKey;
        public Boolean requireIdVerification;
        public Integer maxVerificationAttempts;
        public Integer maxAttempts;  // null = unlimited

        public Response() {}

        public Response(UUID id, String name, String description, Instant startTime, 
                       Instant endTime, Integer durationMinutes, Integer retentionDays, 
                       String createdBy, Instant createdAt, Instant updatedAt,
                       BrowserMode browserMode, SebConfigDto sebConfig, String sebConfigKey,
                       Boolean requireIdVerification, Integer maxVerificationAttempts) {
            this.id = id;
            this.name = name;
            this.description = description;
            this.startTime = startTime;
            this.endTime = endTime;
            this.durationMinutes = durationMinutes != null ? durationMinutes : calculateDuration(startTime, endTime);
            this.retentionDays = retentionDays;
            this.createdBy = createdBy;
            this.createdAt = createdAt;
            this.updatedAt = updatedAt;
            this.status = calculateStatus(startTime, endTime);
            this.browserMode = browserMode != null ? browserMode.name() : "NORMAL";
            this.sebConfig = sebConfig;
            this.sebConfigKey = sebConfigKey;
            this.requireIdVerification = requireIdVerification;
            this.maxVerificationAttempts = maxVerificationAttempts;
            // maxAttempts set separately via setter
        }

        private String calculateStatus(Instant startTime, Instant endTime) {
            Instant now = Instant.now();
            if (startTime != null && endTime != null) {
                if (now.isBefore(startTime)) return "UPCOMING";
                if (now.isAfter(endTime)) return "ENDED";
                return "ACTIVE";
            }
            if (startTime != null && now.isAfter(startTime)) {
                return "ACTIVE";
            }
            return "UPCOMING";
        }

        private Integer calculateDuration(Instant startTime, Instant endTime) {
            if (startTime != null && endTime != null) {
                long durationSeconds = endTime.getEpochSecond() - startTime.getEpochSecond();
                return (int) (durationSeconds / 60); // Convert to minutes
            }
            return 0;
        }
    }

    public static class CreateRequest {
        @NotBlank(message = "Exam name is required")
        public String name;
        
        public String description;
        
        @NotNull(message = "Start time is required")
        public Instant startTime;
        
        public Instant endTime;
        
        public Integer durationMinutes;
        
        public Integer retentionDays = 30;
        
        // SEB Configuration
        public String browserMode = "NORMAL"; // NORMAL, SEB_REQUIRED, SEB_OPTIONAL
        public SebConfigDto sebConfig;
        public Boolean requireIdVerification = true;
        public Integer maxVerificationAttempts = 5;
        public Integer maxAttempts;  // null = unlimited (default)
    }

    public static class UpdateRequest {
        public String name;
        public String description;
        public Instant startTime;
        public Instant endTime;
        public Integer durationMinutes;
        public Integer retentionDays;
        
        // SEB Configuration
        public String browserMode;
        public SebConfigDto sebConfig;
        public Boolean requireIdVerification;
        public Integer maxVerificationAttempts;
        public Integer maxAttempts;  // null = unlimited
    }
    
    /**
     * Generate a random SEB config key
     * Used when creating exams with SEB_REQUIRED or SEB_OPTIONAL mode
     */
    public static String generateSebConfigKey() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}


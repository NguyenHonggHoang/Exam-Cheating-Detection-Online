package com.example.exam.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "exams")
public class Exam {

    /**
     * Browser mode for exam security
     */
    public enum BrowserMode {
        NORMAL,          // Any browser allowed
        SEB_REQUIRED,    // Must use Safe Exam Browser
        SEB_OPTIONAL     // SEB recommended but not required
    }

    @Embeddable
    public static class SebConfig {
        // Basic Settings
        @Column(name = "seb_quit_password", length = 100)
        private String quitPassword;

        @Column(name = "seb_admin_password", length = 100)
        private String adminPassword;

        @Column(name = "seb_allow_wifi")
        private Boolean allowWifi = true;

        @Column(name = "seb_show_taskbar")
        private Boolean showTaskBar = true;
        
        @Column(name = "seb_show_reload_button")
        private Boolean showReloadButton = true;
        
        @Column(name = "seb_show_time")
        private Boolean showTime = true;
        
        @Column(name = "seb_show_input_language")
        private Boolean showInputLanguage = true;
        
        @Column(name = "seb_allow_quit")
        private Boolean allowQuit = true;

        // Security - VM & Remote Detection
        @Column(name = "seb_detect_virtual_machine")
        private Boolean detectVirtualMachine = true;
        
        @Column(name = "seb_allow_remote_desktop")
        private Boolean allowRemoteDesktop = false;

        // Security - Display
        @Column(name = "seb_allow_multiple_displays")
        private Boolean allowMultipleDisplays = false;
        
        @Column(name = "seb_allow_display_mirroring")
        private Boolean allowDisplayMirroring = false;
        
        @Column(name = "seb_block_screen_capture")
        private Boolean blockScreenCapture = true;

        // Security - Kiosk Mode
        @Column(name = "seb_enable_kiosk_mode")
        private Boolean enableKioskMode = true;
        
        @Column(name = "seb_enable_private_clipboard")
        private Boolean enablePrivateClipboard = true;

        // URL Filter Rules (JSON array of allowed URL patterns)
        @Column(name = "seb_url_filter_rules", columnDefinition = "TEXT")
        private String urlFilterRules;

        // Prohibited Processes (JSON array of process definitions)
        // Format: [{"identifier": "obs64.exe", "os": 1, "description": "OBS Studio"}, ...]
        @Column(name = "seb_prohibited_processes", columnDefinition = "TEXT")
        private String prohibitedProcesses;

        // Basic Getters and Setters
        public String getQuitPassword() { return quitPassword; }
        public void setQuitPassword(String quitPassword) { this.quitPassword = quitPassword; }
        public String getAdminPassword() { return adminPassword; }
        public void setAdminPassword(String adminPassword) { this.adminPassword = adminPassword; }
        public Boolean getAllowWifi() { return allowWifi; }
        public void setAllowWifi(Boolean allowWifi) { this.allowWifi = allowWifi; }
        public Boolean getShowTaskBar() { return showTaskBar; }
        public void setShowTaskBar(Boolean showTaskBar) { this.showTaskBar = showTaskBar; }
        public Boolean getShowReloadButton() { return showReloadButton; }
        public void setShowReloadButton(Boolean showReloadButton) { this.showReloadButton = showReloadButton; }
        public Boolean getShowTime() { return showTime; }
        public void setShowTime(Boolean showTime) { this.showTime = showTime; }
        public Boolean getShowInputLanguage() { return showInputLanguage; }
        public void setShowInputLanguage(Boolean showInputLanguage) { this.showInputLanguage = showInputLanguage; }
        public Boolean getAllowQuit() { return allowQuit; }
        public void setAllowQuit(Boolean allowQuit) { this.allowQuit = allowQuit; }
        
        // Security Getters and Setters
        public Boolean getDetectVirtualMachine() { return detectVirtualMachine; }
        public void setDetectVirtualMachine(Boolean detectVirtualMachine) { this.detectVirtualMachine = detectVirtualMachine; }
        public Boolean getAllowRemoteDesktop() { return allowRemoteDesktop; }
        public void setAllowRemoteDesktop(Boolean allowRemoteDesktop) { this.allowRemoteDesktop = allowRemoteDesktop; }
        public Boolean getAllowMultipleDisplays() { return allowMultipleDisplays; }
        public void setAllowMultipleDisplays(Boolean allowMultipleDisplays) { this.allowMultipleDisplays = allowMultipleDisplays; }
        public Boolean getAllowDisplayMirroring() { return allowDisplayMirroring; }
        public void setAllowDisplayMirroring(Boolean allowDisplayMirroring) { this.allowDisplayMirroring = allowDisplayMirroring; }
        public Boolean getBlockScreenCapture() { return blockScreenCapture; }
        public void setBlockScreenCapture(Boolean blockScreenCapture) { this.blockScreenCapture = blockScreenCapture; }
        public Boolean getEnableKioskMode() { return enableKioskMode; }
        public void setEnableKioskMode(Boolean enableKioskMode) { this.enableKioskMode = enableKioskMode; }
        public Boolean getEnablePrivateClipboard() { return enablePrivateClipboard; }
        public void setEnablePrivateClipboard(Boolean enablePrivateClipboard) { this.enablePrivateClipboard = enablePrivateClipboard; }
        public String getUrlFilterRules() { return urlFilterRules; }
        public void setUrlFilterRules(String urlFilterRules) { this.urlFilterRules = urlFilterRules; }
        public String getProhibitedProcesses() { return prohibitedProcesses; }
        public void setProhibitedProcesses(String prohibitedProcesses) { this.prohibitedProcesses = prohibitedProcesses; }
    }

    @Id
    private UUID id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column
    private String description;

    @Column(name = "start_time")
    private Instant startTime;

    @Column(name = "end_time")
    private Instant endTime;
    
    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Column(name = "retention_days", nullable = false)
    private Integer retentionDays;
    
    // SEB Configuration
    @Enumerated(EnumType.STRING)
    @Column(name = "browser_mode", length = 20)
    private BrowserMode browserMode = BrowserMode.NORMAL;
    
    @Embedded
    private SebConfig sebConfig;
    
    @Column(name = "seb_config_key", length = 255)
    private String sebConfigKey;
    
    @Column(name = "require_id_verification")
    private Boolean requireIdVerification = true;
    
    @Column(name = "max_verification_attempts")
    private Integer maxVerificationAttempts = 5;
    
    @Column(name = "max_attempts")
    private Integer maxAttempts;  // null = unlimited

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Exam() {
        this.id = UUID.randomUUID();
    }

    // getters/setters
    public UUID getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Instant getStartTime() { return startTime; }
    public void setStartTime(Instant startTime) { this.startTime = startTime; }
    public Instant getEndTime() { return endTime; }
    public void setEndTime(Instant endTime) { this.endTime = endTime; }
    public Integer getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(Integer durationMinutes) { this.durationMinutes = durationMinutes; }
    public Integer getRetentionDays() { return retentionDays; }
    public void setRetentionDays(Integer retentionDays) { this.retentionDays = retentionDays; }
    public BrowserMode getBrowserMode() { return browserMode; }
    public void setBrowserMode(BrowserMode browserMode) { this.browserMode = browserMode; }
    public String getSebConfigKey() { return sebConfigKey; }
    public void setSebConfigKey(String sebConfigKey) { this.sebConfigKey = sebConfigKey; }
    public Boolean getRequireIdVerification() { return requireIdVerification; }
    public void setRequireIdVerification(Boolean requireIdVerification) { this.requireIdVerification = requireIdVerification; }
    public Integer getMaxVerificationAttempts() { return maxVerificationAttempts; }
    public void setMaxVerificationAttempts(Integer maxVerificationAttempts) { this.maxVerificationAttempts = maxVerificationAttempts; }
    public Integer getMaxAttempts() { return maxAttempts; }
    public void setMaxAttempts(Integer maxAttempts) { this.maxAttempts = maxAttempts; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public SebConfig getSebConfig() { return sebConfig; }
    public void setSebConfig(SebConfig sebConfig) { this.sebConfig = sebConfig; }
}


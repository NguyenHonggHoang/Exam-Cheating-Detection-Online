package com.example.exam.controller;

import com.example.exam.model.Exam;
import com.example.exam.repository.ExamRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.util.DigestUtils;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class SebController {

    private final ExamRepository examRepository;

    /**
     * Generate SEB Configuration file for a specific exam
     *
     * @param examId The ID of the exam
     * @return .seb file download
     */
    @GetMapping("/{examId}/seb-config")
    public ResponseEntity<byte[]> downloadSebConfig(@PathVariable UUID examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new RuntimeException("Exam not found"));

        if (exam.getBrowserMode() == Exam.BrowserMode.NORMAL) {
            return ResponseEntity.badRequest().body("This exam does not require Safe Exam Browser".getBytes());
        }

        // Configuration Parameters
        // TODO: Get real frontend URL from properties
        String quitPassword = "password"; 
        String adminPassword = "password"; 
        
        // Use configured passwords if available
        if (exam.getSebConfig() != null) {
            if (exam.getSebConfig().getQuitPassword() != null && !exam.getSebConfig().getQuitPassword().isEmpty()) {
                quitPassword = exam.getSebConfig().getQuitPassword();
            }
            if (exam.getSebConfig().getAdminPassword() != null && !exam.getSebConfig().getAdminPassword().isEmpty()) {
                adminPassword = exam.getSebConfig().getAdminPassword();
            }
        }
        
        // Use external URL for production compatibility
        // Note: For now we default to localhost, but this should be configurable
        String baseUrl = "http://localhost:5173"; 
        // TODO: Inject base URL from properties
        
        String startUrl = baseUrl + "/exams/" + examId + "/start";
        
        // Generate SEB Config XML
        String sebXml = generateSebXml(startUrl, adminPassword, quitPassword, examId.toString(), exam.getSebConfig());
        byte[] sebBytes = sebXml.getBytes(StandardCharsets.UTF_8);

        // Generate filename
        String filename = "exam-" + examId.toString().substring(0, 8) + ".seb";

        // Calculate Config Key (Simplified - real SEB key logic is complex)
        // Using SHA-256 of the XML content as a simplistic hash for demo
        String configKey = DigestUtils.md5DigestAsHex(sebBytes);
        
        // Store config key if not set (or update it)
        if (exam.getSebConfigKey() == null || !exam.getSebConfigKey().equals(configKey)) {
             // In a real app, save this back to DB. For now just log.
             // exam.setSebConfigKey(configKey);
             // examRepository.save(exam);
             log.info("Generated SEB Config Key for Exam {}: {}", examId, configKey);
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(sebBytes.length)
                .body(sebBytes);
    }

    private String generateSebXml(String startUrl, String adminPassword, String quitPassword, String examId, Exam.SebConfig config) {
        // Basic Settings with Defaults
        boolean allowWifi = true;
        boolean showTaskBar = true;
        boolean showReloadButton = true;
        boolean showTime = true;
        boolean showInputLanguage = true;
        boolean allowQuit = true;
        
        // Security Settings with Secure Defaults
        boolean detectVirtualMachine = true;
        boolean allowRemoteDesktop = false;
        boolean allowMultipleDisplays = false;
        boolean allowDisplayMirroring = false;
        boolean blockScreenCapture = true;
        boolean enableKioskMode = true;
        boolean enablePrivateClipboard = true;
        String prohibitedProcessesJson = null;
        String urlFilterRulesJson = null;
        
        if (config != null) {
            // Basic settings
            if (config.getAllowWifi() != null) allowWifi = config.getAllowWifi();
            if (config.getShowTaskBar() != null) showTaskBar = config.getShowTaskBar();
            if (config.getShowReloadButton() != null) showReloadButton = config.getShowReloadButton();
            if (config.getShowTime() != null) showTime = config.getShowTime();
            if (config.getShowInputLanguage() != null) showInputLanguage = config.getShowInputLanguage();
            if (config.getAllowQuit() != null) allowQuit = config.getAllowQuit();
            
            // Security settings
            if (config.getDetectVirtualMachine() != null) detectVirtualMachine = config.getDetectVirtualMachine();
            if (config.getAllowRemoteDesktop() != null) allowRemoteDesktop = config.getAllowRemoteDesktop();
            if (config.getAllowMultipleDisplays() != null) allowMultipleDisplays = config.getAllowMultipleDisplays();
            if (config.getAllowDisplayMirroring() != null) allowDisplayMirroring = config.getAllowDisplayMirroring();
            if (config.getBlockScreenCapture() != null) blockScreenCapture = config.getBlockScreenCapture();
            if (config.getEnableKioskMode() != null) enableKioskMode = config.getEnableKioskMode();
            if (config.getEnablePrivateClipboard() != null) enablePrivateClipboard = config.getEnablePrivateClipboard();
            
            // JSON fields
            prohibitedProcessesJson = config.getProhibitedProcesses();
            urlFilterRulesJson = config.getUrlFilterRules();
            
            // Debug logging
            log.info("SEB Config - prohibitedProcessesJson: {}", prohibitedProcessesJson);
        }
        
        // Build prohibited processes XML
        String prohibitedProcessesXml = buildProhibitedProcessesXml(prohibitedProcessesJson);
        log.info("SEB Config - built XML length: {}", prohibitedProcessesXml.length());
        
        // Build URL filter rules XML
        String urlFilterRulesXml = buildUrlFilterRulesXml(urlFilterRulesJson, startUrl);
        
        // Generate random exam key salt (32 bytes = 256 bits)
        byte[] saltBytes = new byte[32];
        new java.security.SecureRandom().nextBytes(saltBytes);
        String examKeySalt = java.util.Base64.getEncoder().encodeToString(saltBytes);
        
        // Extract base URL from startUrl for quitURL
        String baseUrl;
        try {
            java.net.URL url = new java.net.URL(startUrl);
            baseUrl = url.getProtocol() + "://" + url.getHost() + (url.getPort() != -1 ? ":" + url.getPort() : "");
        } catch (Exception e) {
            baseUrl = "http://localhost:5173"; // Fallback
        }
        String quitUrl = baseUrl + "/exams/" + examId + "/finished";
    
        // Comprehensive SEB Configuration XML
        return """
            <?xml version="1.0" encoding="utf-8"?>
            <!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
            <plist version="1.0">
              <dict>
                <!-- Basic URLs -->
                <key>startURL</key>
                <string>%s</string>
                <key>quitURL</key>
                <string>%s</string>
                
                <!-- Browser Exam Key -->
                <key>sendBrowserExamKey</key>
                <true/>
                <key>examKeySalt</key>
                <data>%s</data>
                
                <!-- Password Protection -->
                <key>hashedAdminPassword</key>
                <string>%s</string>
                <key>hashedQuitPassword</key>
                <string>%s</string>
                
                <!-- Exit Controls -->
                <key>allowQuit</key>
                <%s/>
                <key>exitKey1</key>
                <integer>27</integer>
                <key>exitModifier1</key>
                <integer>0</integer>
                
                <!-- UI Settings -->
                <key>showTaskBar</key>
                <%s/>
                <key>showReloadButton</key>
                <%s/>
                <key>showTime</key>
                <%s/>
                <key>showInputLanguage</key>
                <%s/>
                <key>enableRightMouse</key>
                <false/>
                <key>lockScreenWhileLoading</key>
                <false/>
                <key>allowSpellCheck</key>
                <false/>
                
                <!-- Network Settings -->
                <key>allowWlan</key>
                <%s/>
                
                <!-- VM & Remote Detection -->
                <key>detectVirtualMachine</key>
                <%s/>
                <key>allowVirtualMachine</key>
                <%s/>
                
                <!-- Display Security -->
                <key>allowMultipleDisplays</key>
                <%s/>
                <key>allowDisplayMirroring</key>
                <%s/>
                <key>blockScreenCapture</key>
                <%s/>
                
                <!-- Kiosk Mode -->
                <key>createNewDesktop</key>
                <%s/>
                <key>killExplorerShell</key>
                <%s/>
                
                <!-- Clipboard -->
                <key>enablePrivateClipboard</key>
                <%s/>
                
                <!-- Prohibited Processes -->
                <key>prohibitedProcesses</key>
                <array>
%s
                </array>
                
                <!-- URL Filter Rules -->
                <key>URLFilterEnable</key>
                <%s/>
                <key>URLFilterRules</key>
                <array>
%s
                </array>
              </dict>
            </plist>
            """.formatted(
                startUrl,
                quitUrl,
                examKeySalt,
                hashPassword(adminPassword),
                hashPassword(quitPassword),
                allowQuit,
                showTaskBar,
                showReloadButton,
                showTime,
                showInputLanguage,
                allowWifi,
                detectVirtualMachine,
                !detectVirtualMachine, // allowVirtualMachine is inverse of detect
                allowMultipleDisplays,
                allowDisplayMirroring,
                blockScreenCapture,
                enableKioskMode, // createNewDesktop
                enableKioskMode, // killExplorerShell
                enablePrivateClipboard,
                prohibitedProcessesXml,
                urlFilterRulesJson != null && !urlFilterRulesJson.isEmpty(),
                urlFilterRulesXml
            );
    }
    
    /**
     * Build prohibited processes XML from JSON config
     * JSON format: [{"identifier": "obs64.exe", "os": 1, "description": "OBS Studio"}, ...]
     * os: 1 = Windows, 2 = macOS
     */
    private String buildProhibitedProcessesXml(String json) {
        if (json == null || json.isEmpty()) {
            log.debug("buildProhibitedProcessesXml: json is null or empty");
            return "";
        }
        
        StringBuilder sb = new StringBuilder();
        try {
            // Use regex to extract individual JSON objects
            java.util.regex.Pattern objectPattern = java.util.regex.Pattern.compile(
                "\\{[^}]+\\}"
            );
            java.util.regex.Matcher matcher = objectPattern.matcher(json);
            
            int count = 0;
            while (matcher.find()) {
                String obj = matcher.group();
                count++;
                
                String identifier = extractJsonStringValue(obj, "identifier");
                String osStr = extractJsonStringValue(obj, "os");
                String description = extractJsonStringValue(obj, "description");
                
                log.debug("Parsing object {}: identifier={}, os={}, desc={}", count, identifier, osStr, description);
                
                if (identifier != null && !identifier.isEmpty()) {
                    int os = 1; // Default Windows
                    try { 
                        if (osStr != null) {
                            os = Integer.parseInt(osStr.trim()); 
                        }
                    } catch (Exception e) {}
                    
                    sb.append("                  <dict>\n");
                    sb.append("                    <key>identifier</key>\n");
                    sb.append("                    <string>").append(escapeXml(identifier)).append("</string>\n");
                    sb.append("                    <key>os</key>\n");
                    sb.append("                    <integer>").append(os).append("</integer>\n");
                    if (description != null && !description.isEmpty()) {
                        sb.append("                    <key>description</key>\n");
                        sb.append("                    <string>").append(escapeXml(description)).append("</string>\n");
                    }
                    sb.append("                    <key>active</key>\n");
                    sb.append("                    <true/>\n");
                    sb.append("                  </dict>\n");
                }
            }
            log.info("buildProhibitedProcessesXml: found {} objects, output length {}", count, sb.length());
        } catch (Exception e) {
            log.warn("Failed to parse prohibited processes JSON: {}", e.getMessage(), e);
        }
        return sb.toString();
    }
    
    /**
     * Extract a string value from a JSON object string
     * Works for both quoted strings and unquoted numbers
     */
    private String extractJsonStringValue(String json, String key) {
        // Try to find "key" : "value" or "key": value
        String pattern1 = "\"" + key + "\"\\s*:\\s*\"([^\"]*)\"";
        String pattern2 = "\"" + key + "\"\\s*:\\s*([^,}\"]+)";
        
        java.util.regex.Pattern p1 = java.util.regex.Pattern.compile(pattern1);
        java.util.regex.Matcher m1 = p1.matcher(json);
        if (m1.find()) {
            return m1.group(1);
        }
        
        java.util.regex.Pattern p2 = java.util.regex.Pattern.compile(pattern2);
        java.util.regex.Matcher m2 = p2.matcher(json);
        if (m2.find()) {
            return m2.group(1).trim();
        }
        
        return null;
    }
    
    /**
     * Build URL filter rules XML from JSON config
     * JSON format: [{"expression": "^https://exam\\.com/.*", "action": 1}, ...]
     * action: 0 = block, 1 = allow
     */
    private String buildUrlFilterRulesXml(String json, String startUrl) {
        StringBuilder sb = new StringBuilder();
        
        // Always add the start URL domain as allowed
        try {
            java.net.URL url = new java.net.URL(startUrl);
            String allowPattern = "^" + url.getProtocol() + "://" + url.getHost().replace(".", "\\.") + "/.*";
            sb.append("                  <dict>\n");
            sb.append("                    <key>expression</key>\n");
            sb.append("                    <string>").append(escapeXml(allowPattern)).append("</string>\n");
            sb.append("                    <key>action</key>\n");
            sb.append("                    <integer>1</integer>\n");
            sb.append("                    <key>active</key>\n");
            sb.append("                    <true/>\n");
            sb.append("                  </dict>\n");
        } catch (Exception e) {
            log.warn("Failed to parse startUrl for URL filter: {}", e.getMessage());
        }
        
        if (json != null && !json.isEmpty()) {
            try {
                json = json.trim();
                if (json.startsWith("[") && json.endsWith("]")) {
                    json = json.substring(1, json.length() - 1);
                    
                    String[] items = json.split("\\},\\s*\\{");
                    for (String item : items) {
                        item = item.replaceAll("[{}]", "").trim();
                        if (item.isEmpty()) continue;
                        
                        String expression = extractJsonValue(item, "expression");
                        String actionStr = extractJsonValue(item, "action");
                        
                        if (expression != null && !expression.isEmpty()) {
                            int action = 1; // Default allow
                            try { action = Integer.parseInt(actionStr); } catch (Exception e) {}
                            
                            sb.append("                  <dict>\n");
                            sb.append("                    <key>expression</key>\n");
                            sb.append("                    <string>").append(escapeXml(expression)).append("</string>\n");
                            sb.append("                    <key>action</key>\n");
                            sb.append("                    <integer>").append(action).append("</integer>\n");
                            sb.append("                    <key>active</key>\n");
                            sb.append("                    <true/>\n");
                            sb.append("                  </dict>\n");
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to parse URL filter rules JSON: {}", e.getMessage());
            }
        }
        return sb.toString();
    }
    
    private String extractJsonValue(String json, String key) {
        // Simple extraction: "key":"value" or "key":number
        String pattern = "\"" + key + "\"\\s*:\\s*";
        int start = json.indexOf(pattern.substring(1)); // Without first quote
        if (start < 0) return null;
        
        start = json.indexOf(":", start) + 1;
        while (start < json.length() && Character.isWhitespace(json.charAt(start))) start++;
        
        if (start >= json.length()) return null;
        
        if (json.charAt(start) == '"') {
            // String value
            int end = json.indexOf('"', start + 1);
            if (end > start) {
                return json.substring(start + 1, end);
            }
        } else {
            // Number or boolean
            int end = start;
            while (end < json.length() && !Character.isWhitespace(json.charAt(end)) 
                   && json.charAt(end) != ',' && json.charAt(end) != '}') {
                end++;
            }
            return json.substring(start, end);
        }
        return null;
    }
    
    private String escapeXml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
    
    /**
     * Hash password using SHA-256 for SEB compatibility
     * SEB uses SHA-256 hash represented as lowercase hexadecimal string
     * 
     * @param password The plaintext password to hash
     * @return SHA-256 hash as hex string, or empty string if password is null/empty
     */
    private String hashPassword(String password) {
        if (password == null || password.isEmpty()) {
            // Return empty string - SEB will disable password protection
            return "";
        }
        
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(password.getBytes(StandardCharsets.UTF_8));
            
            // Convert to hex string
            StringBuilder hexString = new StringBuilder();
            for (byte b : hashBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            
            log.debug("Hashed password (SHA-256): {} -> {}", 
                password.substring(0, Math.min(2, password.length())) + "***", 
                hexString.toString().substring(0, 8) + "...");
            
            return hexString.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            log.error("SHA-256 algorithm not available", e);
            // Fallback to empty - disables password protection
            return "";
        }
    }
}

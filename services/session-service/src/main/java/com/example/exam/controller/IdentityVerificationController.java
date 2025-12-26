package com.example.exam.controller;

import com.example.exam.entity.IdentityVerification;
import com.example.exam.entity.StudentIdentityPhoto;
import com.example.exam.service.IdentityVerificationService;
import com.example.exam.service.StorageService;
import com.example.exam.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Identity Verification Controller
 * 
 * Endpoints for:
 * - Student ID photo upload/management
 * - Face verification during exam
 * - Admin verification of ID photos
 */
@RestController
@RequestMapping("/api/identity")
@Tag(name = "Identity Verification", description = "Face verification for exam proctoring")
public class IdentityVerificationController {
    
    private static final Logger log = LoggerFactory.getLogger(IdentityVerificationController.class);
    
    private final IdentityVerificationService verificationService;
    private final StorageService storageService;
    
    public IdentityVerificationController(
            IdentityVerificationService verificationService,
            StorageService storageService) {
        this.verificationService = verificationService;
        this.storageService = storageService;
    }
    
    // ========== Student ID Photo Management ==========
    
    /**
     * Get presigned URL to upload student ID photo
     */
    @PostMapping("/id-photo/presigned-url")
    @Operation(summary = "Get presigned URL for ID photo upload")
    public ResponseEntity<Map<String, Object>> getIdPhotoUploadUrl(
            @RequestBody IdPhotoRequest request) {
        
        String userId = SecurityUtils.getCurrentUserId();
        // ObjectKey without 'identity/' prefix since bucket is already exam-identity
        String objectKey = String.format("%s/id-photo-%d.jpg", userId, System.currentTimeMillis());
        
        try {
            var presigned = storageService.generatePresignedPutUrl(
                    objectKey,
                    request.contentType != null ? request.contentType : "image/jpeg"
            );
            
            return ResponseEntity.ok(Map.of(
                    "uploadUrl", presigned.uploadUrl(),
                    "objectKey", objectKey,
                    "publicUrl", presigned.publicUrl(),
                    "expiresIn", 300
            ));
        } catch (Exception e) {
            log.error("Failed to generate presigned URL", e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "Failed to generate upload URL"
            ));
        }
    }
    
    /**
     * Confirm ID photo upload (after uploading to MinIO)
     */
    @PostMapping("/id-photo/confirm")
    @Operation(summary = "Confirm ID photo upload")
    public ResponseEntity<Map<String, Object>> confirmIdPhotoUpload(
            @RequestBody ConfirmUploadRequest request) {
        
        String userId = SecurityUtils.getCurrentUserId();
        
        try {
            StudentIdentityPhoto photo = verificationService.uploadIdPhoto(
                    userId,
                    request.objectKey,
                    request.originalFilename,
                    request.fileSize,
                    request.mimeType
            );
            
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "photoId", photo.getId(),
                    "status", photo.getStatus(),
                    "message", "ID photo uploaded successfully. Pending admin verification."
            ));
        } catch (Exception e) {
            log.error("Failed to confirm ID photo upload", e);
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }
    
    /**
     * Direct upload ID photo (for development - bypasses presigned URL)
     * Accepts multipart/form-data with file field
     */
    @PostMapping(value = "/id-photo/upload", consumes = "multipart/form-data")
    @Operation(summary = "Direct upload ID photo")
    public ResponseEntity<Map<String, Object>> uploadIdPhoto(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        
        String userId = SecurityUtils.getCurrentUserId();
        
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "No file provided"
            ));
        }
        
        try {
            String objectKey = String.format("%s/id-card_%d.jpg", userId, System.currentTimeMillis());
            
            // Upload to MinIO via StorageService
            storageService.uploadFile(
                    "exam-identity",
                    objectKey,
                    file.getInputStream(),
                    file.getSize(),
                    file.getContentType()
            );
            
            // Register photo in database
            StudentIdentityPhoto photo = verificationService.uploadIdPhoto(
                    userId,
                    objectKey,
                    file.getOriginalFilename(),
                    file.getSize(),
                    file.getContentType()
            );
            
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "photoId", photo.getId(),
                    "objectKey", objectKey,
                    "status", photo.getStatus(),
                    "message", "ID photo uploaded successfully"
            ));
        } catch (Exception e) {
            log.error("Failed to upload ID photo", e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "error", "Failed to upload: " + e.getMessage()
            ));
        }
    }
    
    /**
     * Get current user's ID photo status
     */
    @GetMapping("/id-photo/status")
    @Operation(summary = "Get ID photo status")
    public ResponseEntity<Map<String, Object>> getIdPhotoStatus() {
        String userId = SecurityUtils.getCurrentUserId();
        
        return verificationService.getIdPhoto(userId)
                .map(photo -> {
                    // Use proxy URL instead of presigned URL to avoid Docker signature issues
                    String photoUrl = "/api/proxy/api/identity/id-photo/view/" + photo.getId();
                    
                    return ResponseEntity.ok(Map.<String, Object>of(
                            "hasPhoto", true,
                            "photoId", photo.getId(),
                            "photoUrl", photoUrl,
                            "status", photo.getStatus(),
                            "uploadedAt", photo.getUploadedAt(),
                            "verifiedAt", photo.getVerifiedAt() != null ? photo.getVerifiedAt() : "",
                            "rejectionReason", photo.getRejectionReason() != null ? photo.getRejectionReason() : ""
                    ));
                })
                .orElse(ResponseEntity.ok(Map.of(
                        "hasPhoto", false,
                        "status", "NOT_UPLOADED",
                        "message", "Please upload your student ID photo"
                )));
    }
    
    /**
     * View ID photo (proxy endpoint - bypasses presigned URL issues)
     */
    @GetMapping("/id-photo/view/{photoId}")
    @Operation(summary = "View ID photo by ID")
    public ResponseEntity<byte[]> viewIdPhoto(@PathVariable String photoId) {
        try {
            var photo = verificationService.getIdPhotoById(UUID.fromString(photoId));
            if (photo.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            
            var inputStream = storageService.getFileStream(photo.get().getObjectKey());
            byte[] imageBytes = inputStream.readAllBytes();
            inputStream.close();
            
            return ResponseEntity.ok()
                    .header("Content-Type", "image/jpeg")
                    .header("Cache-Control", "max-age=3600")
                    .body(imageBytes);
        } catch (Exception e) {
            log.error("Failed to load ID photo {}", photoId, e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // ========== Face Verification During Exam ==========
    
    /**
     * Request identity verification at exam start
     * 
     * Frontend captures snapshot → uploads to MinIO → calls this endpoint
     */
    @PostMapping("/verify")
    @Operation(summary = "Verify identity at exam start")
    public ResponseEntity<Map<String, Object>> verifyIdentity(
            @RequestBody VerifyRequest request) {
        
        String userId = SecurityUtils.getCurrentUserId();
        
        try {
            // Check if user has ID photo
            if (!verificationService.hasIdPhoto(userId)) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "error", "NO_ID_PHOTO",
                        "message", "Please upload your student ID photo first"
                ));
            }
            
            // Queue verification request (async)
            String requestId = verificationService.requestVerification(
                    request.sessionId,
                    userId,
                    request.snapshotObjectKey
            );
            
            return ResponseEntity.accepted().body(Map.of(
                    "success", true,
                    "requestId", requestId,
                    "status", "PENDING",
                    "message", "Verification in progress. Please wait..."
            ));
            
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "ID_PHOTO_REJECTED",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Verification request failed", e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "error", "VERIFICATION_FAILED",
                    "message", e.getMessage()
            ));
        }
    }
    
    /**
     * Get verification result for session
     */
    @GetMapping("/verify/result/{sessionId}")
    @Operation(summary = "Get verification result")
    public ResponseEntity<Map<String, Object>> getVerificationResult(
            @PathVariable UUID sessionId) {
        
        return verificationService.getLatestVerification(sessionId)
                .map(v -> ResponseEntity.ok(Map.<String, Object>of(
                        "hasResult", true,
                        "verified", v.getVerified(),
                        "confidence", v.getConfidence(),
                        "similarity", v.getSimilarity(),
                        "message", v.getMessage() != null ? v.getMessage() : "",
                        "verifiedAt", v.getVerifiedAt(),
                        "referenceFaceDetected", v.getReferenceFaceDetected(),
                        "probeFaceDetected", v.getProbeFaceDetected()
                )))
                .orElse(ResponseEntity.ok(Map.of(
                        "hasResult", false,
                        "status", "PENDING",
                        "message", "Verification in progress..."
                )));
    }
    
    /**
     * Get verification history for session
     */
    @GetMapping("/verify/history/{sessionId}")
    @Operation(summary = "Get verification history")
    public ResponseEntity<List<IdentityVerification>> getVerificationHistory(
            @PathVariable UUID sessionId) {
        
        return ResponseEntity.ok(verificationService.getSessionVerifications(sessionId));
    }
    
    // ========== Admin Endpoints ==========
    
    /**
     * Admin: Verify/reject student ID photo
     */
    @PostMapping("/admin/id-photo/{photoId}/verify")
    @PreAuthorize("hasRole('ADMIN') or hasRole('PROCTOR')")
    @Operation(summary = "Admin: Verify or reject ID photo")
    public ResponseEntity<Map<String, Object>> adminVerifyIdPhoto(
            @PathVariable UUID photoId,
            @RequestBody AdminVerifyRequest request) {
        
        String adminId = SecurityUtils.getCurrentUserId();
        
        try {
            StudentIdentityPhoto photo = verificationService.verifyIdPhoto(
                    photoId,
                    adminId,
                    request.approved,
                    request.reason
            );
            
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "photoId", photo.getId(),
                    "status", photo.getStatus(),
                    "message", request.approved ? "ID photo verified" : "ID photo rejected"
            ));
        } catch (Exception e) {
            log.error("Admin verification failed", e);
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }
    
    // ========== Request DTOs ==========
    
    public static class IdPhotoRequest {
        public String contentType;
    }
    
    public static class ConfirmUploadRequest {
        public String objectKey;
        public String originalFilename;
        public Long fileSize;
        public String mimeType;
    }
    
    public static class VerifyRequest {
        public UUID sessionId;
        public String snapshotObjectKey;
    }
    
    public static class AdminVerifyRequest {
        public boolean approved;
        public String reason;
    }
}

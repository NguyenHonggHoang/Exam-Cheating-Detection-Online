package com.example.exam.controller;

import com.example.exam.dto.StorageMetadataDto;
import com.example.exam.service.PresignedUrlService;
import com.example.exam.service.StorageService;
import com.example.exam.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Storage Controller - Generates presigned URLs for direct MinIO uploads
 * CRITICAL: This controller does NOT handle binary uploads
 */
@RestController
@RequestMapping("/api/storage")
@Tag(name = "Storage")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:3000"})
public class StorageController {

    private final PresignedUrlService presignedUrlService;
    private final StorageService storageService;

    public StorageController(PresignedUrlService presignedUrlService, StorageService storageService) {
        this.presignedUrlService = presignedUrlService;
        this.storageService = storageService;
    }

    /**
     * Get presigned URL for uploading exam evidence (snapshots/clips)
     * 
     * @param type "snapshot" or "clip"
     * @param sessionId Session ID for organizing files
     * @return Presigned upload URL valid for 5 minutes
     */
    @GetMapping("/presigned-url")
    @Operation(
        summary = "Get presigned upload URL",
        description = "Returns a presigned PUT URL for direct upload to MinIO. Client uploads binary data directly to the returned URL."
    )
    public ResponseEntity<Map<String, String>> getPresignedUrl(
            @RequestParam("type") String type,
            @RequestParam(value = "sessionId", required = false) String sessionId
    ) {
        // Validate type
        if (!type.equals("snapshot") && !type.equals("clip") && !type.equals("identity")) {
            return ResponseEntity.badRequest().build();
        }

        // For evidence uploads, sessionId is required
        if ((type.equals("snapshot") || type.equals("clip")) && sessionId == null) {
            return ResponseEntity.badRequest().build();
        }

        Map<String, String> response;

        if (type.equals("identity")) {
            // Identity verification upload
            String userId = SecurityUtils.getCurrentUserId();
            response = presignedUrlService.generateIdentityUploadUrl(userId, "live-photo");
        } else {
            // Evidence upload
            response = presignedUrlService.generateEvidenceUploadUrl(type, sessionId);
        }

        return ResponseEntity.ok(response);
    }

    /**
     * Get presigned URL for identity verification
     * 
     * @param fileType "id-card" or "live-photo"
     * @return Presigned upload URL valid for 10 minutes
     */
    @GetMapping("/identity/presigned-url")
    @Operation(
        summary = "Get presigned URL for identity verification",
        description = "Returns a presigned PUT URL for uploading ID card or live photo"
    )
    public ResponseEntity<Map<String, String>> getIdentityUploadUrl(
            @RequestParam("fileType") String fileType
    ) {
        if (!fileType.equals("id-card") && !fileType.equals("live-photo")) {
            return ResponseEntity.badRequest().build();
        }

        String userId = SecurityUtils.getCurrentUserId();
        Map<String, String> response = presignedUrlService.generateIdentityUploadUrl(userId, fileType);

        return ResponseEntity.ok(response);
    }
    
    /**
     * Get presigned URL for viewing/downloading a file
     * 
     * @param objectKey The object key (path) in MinIO
     * @return Presigned GET URL valid for 30 minutes
     */
    @GetMapping("/view-url")
    @Operation(
        summary = "Get presigned URL for viewing a file",
        description = "Returns a presigned GET URL for viewing/downloading a file from MinIO"
    )
    public ResponseEntity<Map<String, String>> getViewUrl(
            @RequestParam("objectKey") String objectKey
    ) {
        try {
            // Generate presigned GET URL using StorageService
            String viewUrl = presignedUrlService.generateViewUrl(objectKey);
            
            return ResponseEntity.ok(Map.of(
                    "viewUrl", viewUrl,
                    "objectKey", objectKey,
                    "expiresIn", "1800" // 30 minutes
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "Failed to generate view URL"
            ));
        }
    }
    
    /**
     * Get metadata for a storage object
     * 
     * @param objectKey The object key (path) in MinIO
     * @return StorageMetadataDto with file size, content type, last modified, and duration (if available)
     */
    @GetMapping("/metadata")
    @Operation(
        summary = "Get storage object metadata",
        description = "Returns metadata for a storage object including file size, content type, last modified timestamp, and duration (for video files)"
    )
    public ResponseEntity<StorageMetadataDto> getMetadata(
            @RequestParam("objectKey") String objectKey
    ) {
        return storageService.getObjectMetadata(objectKey)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}

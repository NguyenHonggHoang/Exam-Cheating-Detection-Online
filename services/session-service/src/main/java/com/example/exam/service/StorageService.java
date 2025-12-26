package com.example.exam.service;

import com.example.exam.dto.StorageMetadataDto;
import io.minio.GetObjectArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import io.minio.errors.ErrorResponseException;
import io.minio.http.Method;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

/**
 * Storage Service for file upload/download operations
 * 
 * Provides a unified interface for storage operations
 * (presigned URLs, file metadata, etc.)
 */
@Service
public class StorageService {
    
    private static final Logger log = LoggerFactory.getLogger(StorageService.class);
    
    private final PresignedUrlService presignedUrlService;
    private final MinioClient minioClient;
    
    @Value("${minio.bucket.evidence:evidence}")
    private String evidenceBucket;
    
    @Value("${minio.bucket.identity:identity}")
    private String identityBucket;
    
    @Value("${minio.endpoint:http://localhost:9002}")
    private String minioEndpoint;
    
    public StorageService(PresignedUrlService presignedUrlService, MinioClient minioClient) {
        this.presignedUrlService = presignedUrlService;
        this.minioClient = minioClient;
    }
    
    /**
     * Generate presigned GET URL for viewing/downloading a file
     * 
     * @param objectKey The object key (path) for the file
     * @return Presigned URL valid for 30 minutes
     */
    public String getPresignedUrl(String objectKey) {
        try {
            // Determine bucket from object key
            String bucket = determineBucket(objectKey);
            
            // Generate presigned GET URL
            String url = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucket)
                            .object(objectKey)
                            .expiry(30, TimeUnit.MINUTES)
                            .build()
            );
            
            // Convert internal URL to public URL
            url = convertToPublicUrl(url);
            
            log.debug("Generated presigned URL for {}/{}", bucket, objectKey);
            return url;
            
        } catch (Exception e) {
            log.error("Failed to generate presigned URL for {}", objectKey, e);
            throw new RuntimeException("Failed to generate presigned URL", e);
        }
    }
    
    /**
     * Generate presigned PUT URL for uploading a file
     * 
     * @param objectKey The object key (path) for the file - MUST match what client uses
     * @param contentType The MIME type of the file
     * @return PresignedUploadInfo with uploadUrl and publicUrl
     */
    public PresignedUploadInfo generatePresignedPutUrl(String objectKey, String contentType) {
        try {
            // Determine bucket from object key prefix
            String bucket = determineBucketForUpload(objectKey);
            
            String uploadUrl = presignedUrlService.generateDirectUploadUrl(bucket, objectKey, contentType);
            String publicUrl = String.format("http://localhost:9002/%s/%s", bucket, objectKey);
            
            log.info("Generated presigned PUT URL for {}/{}", bucket, objectKey);
            
            return new PresignedUploadInfo(uploadUrl, publicUrl);
            
        } catch (Exception e) {
            log.error("Failed to generate presigned PUT URL for {}", objectKey, e);
            throw new RuntimeException("Failed to generate presigned URL", e);
        }
    }
    
    /**
     * Determine bucket for upload based on object key
     */
    private String determineBucketForUpload(String objectKey) {
        if (objectKey == null) return evidenceBucket;
        
        // Identity-related files: id-photo, id-card, live-photo patterns
        if (objectKey.contains("/id-photo") || 
            objectKey.contains("/id-card") || 
            objectKey.contains("/live-photo")) {
            return identityBucket;
        }
        
        return evidenceBucket;
    }
    
    /**
     * Upload a file directly to MinIO
     * 
     * @param bucket The bucket name
     * @param objectKey The object key (path)
     * @param inputStream The file input stream
     * @param size The file size
     * @param contentType The MIME type
     */
    public void uploadFile(String bucket, String objectKey, InputStream inputStream, 
                          long size, String contentType) {
        try {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .stream(inputStream, size, -1)
                            .contentType(contentType != null ? contentType : "application/octet-stream")
                            .build()
            );
            log.info("Uploaded file to {}/{}", bucket, objectKey);
        } catch (Exception e) {
            log.error("Failed to upload file to {}/{}", bucket, objectKey, e);
            throw new RuntimeException("Failed to upload file", e);
        }
    }
    
    /**
     * Get file as InputStream from MinIO
     * Used for proxying files to clients without presigned URL
     * 
     * @param objectKey The object key (path)
     * @return InputStream of the file
     */
    public InputStream getFileStream(String objectKey) {
        try {
            String bucket = determineBucket(objectKey);
            return minioClient.getObject(
                    GetObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .build()
            );
        } catch (Exception e) {
            log.error("Failed to get file from {}", objectKey, e);
            throw new RuntimeException("Failed to get file", e);
        }
    }
    
    /**
     * Get metadata for a storage object
     * 
     * @param objectKey The object key (path) in MinIO
     * @return Optional containing StorageMetadataDto if object exists, empty otherwise
     */
    public Optional<StorageMetadataDto> getObjectMetadata(String objectKey) {
        try {
            String bucket = determineBucket(objectKey);
            
            StatObjectResponse stat = minioClient.statObject(
                    StatObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .build()
            );
            
            // Extract duration from user metadata if available (for video files)
            Long durationMs = null;
            Map<String, String> userMetadata = stat.userMetadata();
            if (userMetadata != null && userMetadata.containsKey("duration-ms")) {
                try {
                    durationMs = Long.parseLong(userMetadata.get("duration-ms"));
                } catch (NumberFormatException e) {
                    log.warn("Invalid duration-ms metadata for {}: {}", objectKey, userMetadata.get("duration-ms"));
                }
            }
            
            StorageMetadataDto metadata = new StorageMetadataDto(
                    objectKey,
                    stat.size(),
                    stat.contentType(),
                    stat.lastModified().toInstant(),
                    durationMs
            );
            
            log.debug("Retrieved metadata for {}/{}: size={}, contentType={}", 
                    bucket, objectKey, stat.size(), stat.contentType());
            
            return Optional.of(metadata);
            
        } catch (ErrorResponseException e) {
            if (e.errorResponse().code().equals("NoSuchKey")) {
                log.debug("Object not found: {}", objectKey);
                return Optional.empty();
            }
            log.error("Failed to get metadata for {}", objectKey, e);
            throw new RuntimeException("Failed to get object metadata", e);
        } catch (Exception e) {
            log.error("Failed to get metadata for {}", objectKey, e);
            throw new RuntimeException("Failed to get object metadata", e);
        }
    }
    
    /**
     * Generate presigned URL for evidence uploads (snapshots, clips)
     */
    public PresignedUploadInfo generateEvidenceUploadUrl(String type, String sessionId) {
        Map<String, String> result = presignedUrlService.generateEvidenceUploadUrl(type, sessionId);
        return new PresignedUploadInfo(
                result.get("uploadUrl"),
                result.get("publicUrl")
        );
    }
    
    /**
     * Determine bucket from object key
     */
    private String determineBucket(String objectKey) {
        if (objectKey == null) return evidenceBucket;
        
        // Check if it's an identity photo (id-card is from direct upload endpoint)
        if (objectKey.contains("identity/") || objectKey.contains("id-photo") || 
            objectKey.contains("live-photo") || objectKey.contains("id-card")) {
            return identityBucket;
        }
        
        // Default to evidence bucket
        return evidenceBucket;
    }
    
    /**
     * Convert internal MinIO URL to public URL
     */
    private String convertToPublicUrl(String url) {
        return url
            .replace("minio:9000", "localhost:9002")
            .replace("http://minio", "http://localhost:9002");
    }
    
    private String extractUserId(String objectKey) {
        // Format: identity/{userId}/filename
        if (objectKey.startsWith("identity/")) {
            String[] parts = objectKey.split("/");
            if (parts.length >= 2) {
                return parts[1];
            }
        }
        return "unknown";
    }
    
    /**
     * Presigned upload information DTO
     */
    public record PresignedUploadInfo(String uploadUrl, String publicUrl) {}
}

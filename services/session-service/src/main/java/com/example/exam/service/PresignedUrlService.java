package com.example.exam.service;

import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.http.Method;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Service for generating presigned URLs for MinIO uploads
 * CRITICAL: Spring Boot does NOT handle binary uploads
 * Flow: Client requests URL → Backend generates presigned URL → Client uploads directly to MinIO
 * 
 * Uses externalMinioClient to generate presigned URLs.
 * Container connects via host.docker.internal but URLs are converted to localhost for browser.
 */
@Service
public class PresignedUrlService {

    private static final Logger log = LoggerFactory.getLogger(PresignedUrlService.class);

    // Use external MinIO client for presigned URLs
    private final MinioClient externalMinioClient;

    @Value("${minio.bucket.evidence}")
    private String evidenceBucket;

    @Value("${minio.bucket.identity}")
    private String identityBucket;

    // External endpoint for container connection (e.g., host.docker.internal:9002)
    @Value("${minio.external-endpoint:http://localhost:9002}")
    private String minioExternalEndpoint;
    
    // Browser endpoint for client URLs (e.g., localhost:9002)
    @Value("${minio.browser-endpoint:${minio.external-endpoint:http://localhost:9002}}")
    private String minioBrowserEndpoint;

    public PresignedUrlService(@Qualifier("externalMinioClient") MinioClient externalMinioClient) {
        this.externalMinioClient = externalMinioClient;
    }

    /**
     * Generate presigned PUT URL for uploading evidence (snapshot/clip)
     */
    public Map<String, String> generateEvidenceUploadUrl(String type, String sessionId) {
        try {
            String timestamp = String.valueOf(System.currentTimeMillis());
            String extension = type.equals("snapshot") ? "jpg" : "webm";
            String objectName = String.format("%s/%s_%s.%s", sessionId, type, timestamp, extension);

            String uploadUrl = externalMinioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.PUT)
                            .bucket(evidenceBucket)
                            .object(objectName)
                            .expiry(5, java.util.concurrent.TimeUnit.MINUTES)
                            .build()
            );
            
            // Convert URL from container endpoint to browser endpoint
            uploadUrl = convertToBrowserUrl(uploadUrl);

            Map<String, String> response = new HashMap<>();
            response.put("uploadUrl", uploadUrl);
            response.put("publicUrl", String.format("%s/%s/%s", minioBrowserEndpoint, evidenceBucket, objectName));
            response.put("objectKey", objectName);
            response.put("expiresIn", "300");

            return response;
        } catch (Exception e) {
            log.error("Failed to generate evidence upload URL", e);
            throw new RuntimeException("Failed to generate presigned URL", e);
        }
    }

    /**
     * Generate presigned PUT URL for identity verification uploads
     */
    public Map<String, String> generateIdentityUploadUrl(String userId, String fileType) {
        try {
            String timestamp = String.valueOf(System.currentTimeMillis());
            String extension = "jpg";
            String objectName = String.format("%s/%s_%s.%s", userId, fileType, timestamp, extension);

            String uploadUrl = externalMinioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.PUT)
                            .bucket(identityBucket)
                            .object(objectName)
                            .expiry(10, java.util.concurrent.TimeUnit.MINUTES)
                            .build()
            );
            
            // Convert URL from container endpoint to browser endpoint
            uploadUrl = convertToBrowserUrl(uploadUrl);

            Map<String, String> response = new HashMap<>();
            response.put("uploadUrl", uploadUrl);
            response.put("publicUrl", String.format("%s/%s/%s", minioBrowserEndpoint, identityBucket, objectName));
            response.put("objectKey", objectName);
            response.put("expiresIn", "600");

            return response;
        } catch (Exception e) {
            log.error("Failed to generate identity upload URL", e);
            throw new RuntimeException("Failed to generate identity upload URL", e);
        }
    }
    
    /**
     * Generate presigned PUT URL for a specific bucket and objectKey
     * This is the most direct method - uses exact bucket and key provided
     */
    public String generateDirectUploadUrl(String bucket, String objectKey, String contentType) {
        try {
            String uploadUrl = externalMinioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.PUT)
                            .bucket(bucket)
                            .object(objectKey)
                            .expiry(10, java.util.concurrent.TimeUnit.MINUTES)
                            .build()
            );
            
            // Convert URL from container endpoint to browser endpoint
            uploadUrl = convertToBrowserUrl(uploadUrl);
            
            log.info("Generated direct upload URL for {}/{}", bucket, objectKey);
            return uploadUrl;
            
        } catch (Exception e) {
            log.error("Failed to generate direct upload URL for {}/{}", bucket, objectKey, e);
            throw new RuntimeException("Failed to generate upload URL", e);
        }
    }

    /**
     * Generate presigned GET URL for viewing/downloading a file
     */
    public String generateViewUrl(String objectKey) {
        try {
            String bucket = determineBucket(objectKey);
            
            String url = externalMinioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucket)
                            .object(objectKey)
                            .expiry(30, java.util.concurrent.TimeUnit.MINUTES)
                            .build()
            );
            
            return convertToBrowserUrl(url);
        } catch (Exception e) {
            log.error("Failed to generate view URL", e);
            throw new RuntimeException("Failed to generate view URL", e);
        }
    }
    
    /**
     * Determine bucket from object key
     */
    private String determineBucket(String objectKey) {
        if (objectKey == null) return evidenceBucket;
        
        if (objectKey.contains("identity/") || objectKey.contains("id-photo") || objectKey.contains("live-photo") || objectKey.contains("id-card")) {
            return identityBucket;
        }
        
        return evidenceBucket;
    }
    
    /**
     * Convert presigned URL from container endpoint (host.docker.internal) to browser endpoint (localhost)
     * This is needed because the signature is computed by container but browser uses different host.
     * 
     * IMPORTANT: This only works because MinIO v4 signatures don't include the Host header in signature.
     * The signature is based on: method, path, query params, date - NOT the host.
     */
    private String convertToBrowserUrl(String url) {
        if (minioExternalEndpoint.equals(minioBrowserEndpoint)) {
            return url; // No conversion needed for local dev
        }
        
        // Extract host portion from external endpoint and replace with browser endpoint
        // e.g., http://host.docker.internal:9002 → http://localhost:9002
        try {
            java.net.URL externalUrl = new java.net.URL(minioExternalEndpoint);
            java.net.URL browserUrl = new java.net.URL(minioBrowserEndpoint);
            
            String externalHost = externalUrl.getHost() + (externalUrl.getPort() > 0 ? ":" + externalUrl.getPort() : "");
            String browserHost = browserUrl.getHost() + (browserUrl.getPort() > 0 ? ":" + browserUrl.getPort() : "");
            
            String converted = url.replace(externalHost, browserHost);
            log.debug("Converted URL: {} -> {}", url, converted);
            return converted;
        } catch (Exception e) {
            log.warn("Failed to convert URL, returning original: {}", url);
            return url;
        }
    }
}



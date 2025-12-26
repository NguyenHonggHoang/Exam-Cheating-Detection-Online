package com.example.exam.service;

import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;

/**
 * MinIO Storage Service
 * 
 * Provides file access from MinIO for serving evidence files
 * 
 * @deprecated As of 2025-12-26, MinIO storage operations should use shared StorageService.
 * This service-specific storage layer may be redundant.
 * This will be removed in a future version.
 */
@Deprecated
@Service
@RequiredArgsConstructor
@Slf4j
public class MinioStorageService {

    private final MinioClient minioClient;

    @Value("${minio.bucket.evidence:exam-evidence}")
    private String evidenceBucket;

    /**
     * Get file as InputStream from MinIO
     * 
     * @param objectKey The object key (path) - may include bucket prefix
     * @return InputStream of the file
     */
    public InputStream getFileStream(String objectKey) {
        try {
            // Strip bucket prefix if present (e.g., "exam-evidence/sessions/..." -> "sessions/...")
            // EgressService sends objectKey with bucket prefix, but MinIO expects just the path
            String actualPath = objectKey;
            String bucketPrefix = evidenceBucket + "/";
            if (objectKey.startsWith(bucketPrefix)) {
                actualPath = objectKey.substring(bucketPrefix.length());
                log.debug("Stripped bucket prefix from objectKey: {} -> {}", objectKey, actualPath);
            }
            
            log.info("🔍 Fetching file from MinIO - Bucket: {}, Object: {}", evidenceBucket, actualPath);
            
            return minioClient.getObject(
                    GetObjectArgs.builder()
                            .bucket(evidenceBucket)
                            .object(actualPath)
                            .build()
            );
        } catch (Exception e) {
            log.error("❌ Failed to get file from MinIO: bucket={}, objectKey={}", evidenceBucket, objectKey, e);
            throw new RuntimeException("Failed to get file", e);
        }
    }
}

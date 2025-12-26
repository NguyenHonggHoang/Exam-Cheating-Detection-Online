package com.example.exam.dto;

import java.time.Instant;

/**
 * DTO for storage object metadata
 * Used to return metadata about files stored in MinIO
 */
public record StorageMetadataDto(
    String objectKey,
    Long fileSize,
    String contentType,
    Instant lastModified,
    Long durationMs
) {
    /**
     * Create a StorageMetadataDto without duration (for non-video files)
     */
    public static StorageMetadataDto withoutDuration(
            String objectKey,
            Long fileSize,
            String contentType,
            Instant lastModified
    ) {
        return new StorageMetadataDto(objectKey, fileSize, contentType, lastModified, null);
    }
}

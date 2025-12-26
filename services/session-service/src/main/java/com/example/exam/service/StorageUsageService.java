package com.example.exam.service;

import com.example.exam.dto.StorageUsageResponse;
import com.example.exam.repository.MediaSnapshotRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Storage Usage Service
 * 
 * Calculates storage usage by querying media_snapshots table
 * (Alternative to Supabase RPC function)
 * 
 * @deprecated As of 2025-12-26, storage quota tracking is not actively used.
 * MinIO handles storage management directly.
 * This will be removed in a future version.
 */
@Deprecated
@Service
@RequiredArgsConstructor
public class StorageUsageService {

    private static final Logger log = LoggerFactory.getLogger(StorageUsageService.class);

    // Default quota: 50MB per session
    private static final long DEFAULT_QUOTA_BYTES = 50 * 1024 * 1024;

    private final MediaSnapshotRepository mediaSnapshotRepository;

    /**
     * Calculate storage usage for a session
     * 
     * @param sessionId Session UUID
     * @return Storage usage details
     */
    public StorageUsageResponse calculateUsage(UUID sessionId) {
        log.debug("Calculating storage usage for session: {}", sessionId);

        try {
            // Query media_snapshots table
            // Assuming MediaSnapshot entity has fileSize field
            Long totalBytes = mediaSnapshotRepository.calculateTotalSize(sessionId);
            Integer fileCount = mediaSnapshotRepository.countBySessionId(sessionId);

            if (totalBytes == null) {
                totalBytes = 0L;
            }
            if (fileCount == null) {
                fileCount = 0;
            }

            boolean quotaExceeded = totalBytes >= DEFAULT_QUOTA_BYTES;

            return new StorageUsageResponse(
                totalBytes,
                fileCount,
                DEFAULT_QUOTA_BYTES,
                quotaExceeded
            );

        } catch (Exception e) {
            log.error("Failed to calculate storage usage for session: {}", sessionId, e);
            throw new RuntimeException("Failed to calculate storage usage", e);
        }
    }

    /**
     * Check if session can upload more files
     * 
     * @param sessionId Session UUID
     * @param additionalBytes Bytes to upload
     * @return true if within quota
     */
    public boolean canUpload(UUID sessionId, long additionalBytes) {
        StorageUsageResponse usage = calculateUsage(sessionId);
        return (usage.getUsageBytes() + additionalBytes) < usage.getLimitBytes();
    }
}

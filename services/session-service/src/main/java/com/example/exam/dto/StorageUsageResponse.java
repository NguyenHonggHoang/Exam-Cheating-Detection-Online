package com.example.exam.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Storage usage summary for a session
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StorageUsageResponse {
    private Long usageBytes;      // Total bytes used
    private Integer fileCount;    // Number of files
    private Long limitBytes;      // Quota limit
    private Boolean quotaExceeded;
}

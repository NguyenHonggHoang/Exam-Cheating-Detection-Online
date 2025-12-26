package com.example.exam.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response with presigned URL and metadata
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PresignedUrlResponse {
    private String uploadUrl;   // Presigned PUT URL for upload
    private String publicUrl;   // Public GET URL for access
    private String objectKey;   // Object key in MinIO bucket
    private Integer expiresIn;  // Expiration time in seconds
}

package com.example.exam.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request for presigned URL generation
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PresignedUrlRequest {
    private String sessionId;
    private String type;         // "snapshot" or "clip"
    private String contentType;  // "image/jpeg" or "video/webm"
}

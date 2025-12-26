package com.example.exam.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Detection result from TensorFlow.js (frontend)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DetectionResultDto {
    private Integer faceCount;
    private Double confidence;
    private HeadPoseDto headPose;
    private EyeStateDto eyeState;
    private Long timestamp;
}

package com.example.exam.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class HeadPoseDto {
    private Double pitch;  // Up/down
    private Double yaw;    // Left/right
    private Double roll;   // Tilt
}

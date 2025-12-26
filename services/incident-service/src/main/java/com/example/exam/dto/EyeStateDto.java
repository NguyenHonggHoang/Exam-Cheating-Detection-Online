package com.example.exam.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EyeStateDto {
    private Boolean leftEyeOpen;
    private Boolean rightEyeOpen;
    private Double aspectRatio;
}

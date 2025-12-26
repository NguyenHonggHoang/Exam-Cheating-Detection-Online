package com.example.exam.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BehaviorAnalysisResponse {
    private String message;
    private String analysisId;
    private Boolean incidentCreated;
    private Float riskScore;
}

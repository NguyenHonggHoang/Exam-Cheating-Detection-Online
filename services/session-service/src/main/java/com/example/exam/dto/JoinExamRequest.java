package com.example.exam.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Request DTO for joining an exam
 */
public record JoinExamRequest(
    @NotBlank(message = "Exam ID is required")
    String examId
) {}

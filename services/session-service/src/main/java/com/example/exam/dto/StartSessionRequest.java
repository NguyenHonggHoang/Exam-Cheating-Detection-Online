package com.example.exam.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public class StartSessionRequest {
    @NotNull
    private UUID examId;

    public UUID getExamId() {
        return examId;
    }

    public void setExamId(UUID examId) {
        this.examId = examId;
    }
}

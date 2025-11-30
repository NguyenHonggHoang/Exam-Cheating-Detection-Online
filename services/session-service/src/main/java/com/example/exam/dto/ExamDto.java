package com.example.exam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

public class ExamDto {

    public static class Response {
        public UUID id;
        public String name;
        public String description;
        public Instant startTime;
        public Instant endTime;
        public Integer retentionDays;
        public String createdBy;
        public Instant createdAt;
        public Instant updatedAt;
        public String status; // ACTIVE, ENDED, UPCOMING
        public Integer durationMinutes; // Calculated from startTime and endTime

        public Response() {}

        public Response(UUID id, String name, String description, Instant startTime, 
                       Instant endTime, Integer retentionDays, String createdBy, 
                       Instant createdAt, Instant updatedAt) {
            this.id = id;
            this.name = name;
            this.description = description;
            this.startTime = startTime;
            this.endTime = endTime;
            this.retentionDays = retentionDays;
            this.createdBy = createdBy;
            this.createdAt = createdAt;
            this.updatedAt = updatedAt;
            this.status = calculateStatus(startTime, endTime);
            this.durationMinutes = calculateDuration(startTime, endTime);
        }

        private String calculateStatus(Instant startTime, Instant endTime) {
            Instant now = Instant.now();
            if (startTime != null && endTime != null) {
                if (now.isBefore(startTime)) return "UPCOMING";
                if (now.isAfter(endTime)) return "ENDED";
                return "ACTIVE";
            }
            if (startTime != null && now.isAfter(startTime)) {
                return "ACTIVE";
            }
            return "UPCOMING";
        }

        private Integer calculateDuration(Instant startTime, Instant endTime) {
            if (startTime != null && endTime != null) {
                long durationSeconds = endTime.getEpochSecond() - startTime.getEpochSecond();
                return (int) (durationSeconds / 60); // Convert to minutes
            }
            return 0;
        }
    }

    public static class CreateRequest {
        @NotBlank(message = "Exam name is required")
        public String name;
        
        public String description;
        
        @NotNull(message = "Start time is required")
        public Instant startTime;
        
        public Instant endTime;
        
        public Integer retentionDays = 30;
    }

    public static class UpdateRequest {
        public String name;
        public String description;
        public Instant startTime;
        public Instant endTime;
        public Integer retentionDays;
    }
}

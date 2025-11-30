package com.example.exam.dto;

import com.example.exam.model.Incident;
import com.example.exam.model.IncidentStatus;
import com.example.exam.model.IncidentType;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public class IncidentDto {

    public static class CreateRequest {
        @NotNull
        public UUID sessionId;
        @NotNull
        public Long ts;
        @NotNull
        public IncidentType type;
        public BigDecimal score;
        public String reason;
        public String evidenceUrl;
    }

    public static class Response {
        public UUID id;
        public UUID sessionId;
        public Long ts;
        public IncidentType type;
        public BigDecimal score;
        public String reason;
        public String evidenceUrl;
        public IncidentStatus status;
        public Instant createdAt;

        public static Response from(Incident i) {
            Response r = new Response();
            r.id = i.getId();
            r.sessionId = i.getSessionId();
            r.ts = i.getTs();
            r.type = i.getType();
            r.score = i.getScore();
            r.reason = i.getReason();
            r.evidenceUrl = i.getEvidenceUrl();
            r.status = i.getStatus();
            r.createdAt = i.getCreatedAt();
            return r;
        }
    }
}

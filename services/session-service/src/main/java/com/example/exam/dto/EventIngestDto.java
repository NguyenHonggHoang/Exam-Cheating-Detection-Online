package com.example.exam.dto;

import com.example.exam.model.EventType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public class EventIngestDto {

    public static class Item {
        @NotNull
        public UUID sessionId;
        @NotNull
        public Long ts;
        @NotNull
        public EventType eventType;
        public String details; // JSON string, optional
        @NotBlank
        public String idempotencyKey;
    }

    public static class Request {
        @NotNull
        @Valid
        public List<Item> items;
    }

    public static class Result {
        public int created;
        public int duplicates;
        public List<UUID> ids;

        public Result(int created, int duplicates, List<UUID> ids) {
            this.created = created;
            this.duplicates = duplicates;
            this.ids = ids;
        }
    }
}

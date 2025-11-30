package com.example.exam.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public class SnapshotUploadDto {

    public static class Item {
        @NotNull
        public UUID sessionId;
        @NotNull
        public Long ts;
        /**
         * Data URL or raw base64 string. Prefer a data URL like: data:image/jpeg;base64,....
         */
        @NotBlank
        public String imageBase64;
        public Integer faceCount;
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

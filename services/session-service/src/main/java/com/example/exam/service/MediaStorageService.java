package com.example.exam.service;

import com.example.exam.dto.SnapshotIngestDto;
import com.example.exam.dto.SnapshotUploadDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
public class MediaStorageService {

    private final Path uploadRoot;

    public MediaStorageService(@Value("${media.upload-dir:/app/uploads}") String uploadDir) {
        this.uploadRoot = Path.of(uploadDir);
    }

    /**
     * Store MultipartFile and return objectKey
     */
    public String storeFile(MultipartFile file) throws IOException {
        // Get timestamp from current time
        var zdt = ZonedDateTime.now(ZoneId.of("UTC"));
        
        // Detect extension
        String originalFilename = file.getOriginalFilename();
        String ext = ".jpg"; // default
        if (originalFilename != null && originalFilename.contains(".")) {
            ext = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        
        // Build object key: uploads/YYYY/MM/DD/uuid.ext
        String objectKey = String.format("%04d/%02d/%02d/", 
            zdt.getYear(), zdt.getMonthValue(), zdt.getDayOfMonth()) +
            UUID.randomUUID() + ext;
        
        // Write file
        Path target = uploadRoot.resolve(objectKey).normalize();
        Files.createDirectories(target.getParent());
        file.transferTo(target);
        
        return objectKey;
    }

    public SnapshotIngestDto.Request prepareIngestRequest(SnapshotUploadDto.Request uploadRequest) {
        List<SnapshotIngestDto.Item> items = new ArrayList<>();

        for (var up : uploadRequest.items) {
            // Decode base64 & detect mime
            var decoded = decodeDataUrl(up.imageBase64);
            String mime = decoded.mime != null ? decoded.mime : "image/jpeg";
            String ext = switch (mime) {
                case "image/png" -> ".png";
                case "image/jpeg", "image/jpg" -> ".jpg";
                default -> ".bin";
            };

            // Build object key: sessionId/YYYY/MM/DD/uuid.ext
            var zdt = ZonedDateTime.ofInstant(java.time.Instant.ofEpochMilli(up.ts), ZoneId.of("UTC"));
            String objectKey = up.sessionId + "/" +
                    String.format("%04d/%02d/%02d/", zdt.getYear(), zdt.getMonthValue(), zdt.getDayOfMonth()) +
                    UUID.randomUUID() + ext;

            // Ensure directory and write file
            Path target = uploadRoot.resolve(objectKey).normalize();
            try {
                Files.createDirectories(target.getParent());
                Files.write(target, decoded.bytes);
            } catch (IOException e) {
                // For MVP, propagate as runtime to signal failure
                throw new RuntimeException("Failed to store snapshot: " + objectKey, e);
            }

            SnapshotIngestDto.Item item = new SnapshotIngestDto.Item();
            item.sessionId = up.sessionId;
            item.ts = up.ts;
            item.objectKey = objectKey;
            item.fileSize = (long) decoded.bytes.length;
            item.mimeType = mime;
            item.faceCount = up.faceCount;
            item.idempotencyKey = up.idempotencyKey;

            items.add(item);
        }

        SnapshotIngestDto.Request req = new SnapshotIngestDto.Request();
        req.items = items;
        return req;
    }

    private static Decoded decodeDataUrl(String dataUrlOrBase64) {
        String base64Part = dataUrlOrBase64;
        String mime = null;
        if (dataUrlOrBase64.startsWith("data:")) {
            int comma = dataUrlOrBase64.indexOf(',');
            if (comma > 0) {
                String header = dataUrlOrBase64.substring(5, comma); // skip 'data:'
                // e.g. image/jpeg;base64
                String[] parts = header.split(";");
                if (parts.length > 0) {
                    mime = parts[0];
                }
                base64Part = dataUrlOrBase64.substring(comma + 1);
            }
        }
        byte[] bytes = Base64.getDecoder().decode(base64Part);
        return new Decoded(mime, bytes);
    }

    private record Decoded(String mime, byte[] bytes) {}
}

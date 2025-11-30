package com.example.exam.controller;

import com.example.exam.dto.EventIngestDto;
import com.example.exam.dto.SnapshotIngestDto;
import com.example.exam.dto.SnapshotUploadDto;
import com.example.exam.service.IngestService;
import com.example.exam.service.MediaStorageService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

@RestController
@RequestMapping("/api/ingest")
public class IngestController {
    private final IngestService ingestService;
    private final MediaStorageService mediaStorageService;

    public IngestController(IngestService ingestService, MediaStorageService mediaStorageService) {
        this.ingestService = ingestService;
        this.mediaStorageService = mediaStorageService;
    }

    @PostMapping("/events")
    @Operation(summary = "Ingest events (idempotent)")
    public ResponseEntity<EventIngestDto.Result> ingestEvents(@Valid @RequestBody EventIngestDto.Request request) {
        var result = ingestService.ingestEvents(request);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/snapshots")
    @Operation(summary = "Ingest media snapshots (idempotent)")
    public ResponseEntity<SnapshotIngestDto.Result> ingestSnapshots(@Valid @RequestBody SnapshotIngestDto.Request request) {
        var result = ingestService.ingestSnapshots(request);
        return ResponseEntity.ok(result);
    }

    @PostMapping(value = "/snapshots/upload", consumes = "multipart/form-data")
    @Operation(summary = "Upload snapshot file via multipart (real-time exam)")
    public ResponseEntity<SnapshotUploadDto.Result> uploadSnapshotFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("sessionId") UUID sessionId,
            @RequestParam("ts") Long ts
    ) throws IOException {
        // Generate idempotency key
        String idempotencyKey = sessionId + "-snapshot-" + ts;
        
        // Store file to disk
        String objectKey = mediaStorageService.storeFile(file);
        
        // Prepare ingest request
        var item = new SnapshotIngestDto.Item();
        item.sessionId = sessionId;
        item.ts = ts;
        item.objectKey = objectKey;
        item.fileSize = file.getSize();
        item.mimeType = file.getContentType();
        item.faceCount = null; // will be set by worker later
        item.idempotencyKey = idempotencyKey;
        
        var ingestReq = new SnapshotIngestDto.Request();
        ingestReq.items = java.util.List.of(item);
        
        // Ingest to database
        var ingestResult = ingestService.ingestSnapshots(ingestReq);
        
        return ResponseEntity.ok(new SnapshotUploadDto.Result(
            ingestResult.created, 
            ingestResult.duplicates, 
            ingestResult.ids
        ));
    }

    @PostMapping("/snapshots/upload-base64")
    @Operation(summary = "Upload snapshots as base64 and ingest (legacy, writes to disk, idempotent)")
    public ResponseEntity<SnapshotUploadDto.Result> uploadSnapshotsBase64(@Valid @RequestBody SnapshotUploadDto.Request request) {
        // Store images to disk and transform to SnapshotIngestDto to reuse existing path
        var ingestReq = mediaStorageService.prepareIngestRequest(request);
        var ingestResult = ingestService.ingestSnapshots(ingestReq);
        return ResponseEntity.ok(new SnapshotUploadDto.Result(ingestResult.created, ingestResult.duplicates, ingestResult.ids));
    }
}

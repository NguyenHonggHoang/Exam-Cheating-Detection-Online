package com.example.exam.controller;

import com.example.exam.dto.IncidentDto;
import com.example.exam.model.Incident;
import com.example.exam.repository.IncidentRepository;
import com.example.exam.repository.SessionShadowRepository;
import com.example.exam.service.IncidentService;
import com.example.exam.service.MinioStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import lombok.Data;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;
import java.util.List;
import java.util.Map;
import java.util.Base64;
import java.util.HashMap;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

/**
 * Incident Management Controller - Incident Service
 * 
 * Handles CRUD operations for incidents
 * Uses shadow tables for fast queries
 */
@RestController
@RequestMapping("/api/incidents")
@Tag(name = "Incidents", description = "Incident management endpoints")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:3000"})
@Slf4j
public class IncidentController {

    private final IncidentRepository incidentRepository;
    private final SessionShadowRepository sessionShadowRepository;
    private final IncidentService incidentService;
    private final MinioStorageService minioStorageService;

    /**
     * List incidents with filtering and pagination
     * 
     * Supports filtering by:
     * - sessionId: Specific session
     * - examId: All incidents for an exam (uses shadow table)
     * - severity: Filter by severity level
     * - status: Filter by status
     */
    @GetMapping
    @Operation(summary = "List incidents with filtering and pagination")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('PROCTOR', 'ADMIN', 'STUDENT')")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<Page<IncidentDto.Response>> listIncidents(
            @RequestParam(value = "sessionId", required = false) UUID sessionId,
            @RequestParam(value = "examId", required = false) String examId,
            @RequestParam(value = "severity", required = false) String severity,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestParam(value = "sort", defaultValue = "detectedAt,desc") String sort,
            org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken auth
    ) {
        // Parse sort parameter
        String[] sortParts = sort.split(",");
        String sortProp = sortParts[0];
        Sort.Direction dir = (sortParts.length > 1 && sortParts[1].equalsIgnoreCase("asc")) 
            ? Sort.Direction.ASC 
            : Sort.Direction.DESC;
        
        Pageable pageable = PageRequest.of(page, size, Sort.by(dir, sortProp));
        
        boolean isStudent = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_STUDENT"));
        UUID userId = null;
        if (isStudent) {
            userId = UUID.fromString(auth.getToken().getSubject());
        }

        // Delegate to service for complex filtering
        Page<Incident> incidents = incidentService.findIncidents(
            sessionId, examId, severity, status, userId, isStudent, pageable
        );
        
        return ResponseEntity.ok(incidents.map(IncidentDto.Response::from));
    }

    /**
     * Get incident by ID with full details
     */
    @GetMapping("/{id}")
    @Operation(summary = "Get incident details by ID")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('PROCTOR', 'ADMIN', 'STUDENT')")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<IncidentDto.DetailedResponse> getIncident(
            @PathVariable UUID id,
            org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken auth
    ) {
        return incidentRepository.findById(id)
            .map(incident -> {
                // Check STUDENT ownership
                boolean isStudent = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_STUDENT"));
                UUID userId = UUID.fromString(auth.getToken().getSubject());
                if (isStudent && !sessionShadowRepository.isSessionOwnedByUser(incident.getSessionId(), userId)) {
                    throw new org.springframework.security.access.AccessDeniedException("Access Denied");
                }

                // Enrich with shadow data
                var detailed = IncidentDto.DetailedResponse.from(incident);
                
                // Add session context from shadow table
                sessionShadowRepository.findById(incident.getSessionId()).ifPresent(session -> {
                    detailed.setExamId(session.getExamId().toString());
                    detailed.setUserId(session.getUserId().toString());
                    detailed.setSessionStatus(session.getStatus());
                });
                
                return ResponseEntity.ok(detailed);
            })
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Update incident status
     * 
     * Used by proctors to mark incidents as reviewed/dismissed
     */
    @PatchMapping("/{id}/status")
    @Operation(summary = "Update incident status")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('incident.write')")
    public ResponseEntity<IncidentDto.Response> updateStatus(
            @PathVariable UUID id,
            @RequestBody IncidentDto.UpdateStatusRequest request
    ) {
        Incident updated = incidentService.updateStatus(id, request.getStatus(), request.getNotes());
        return ResponseEntity.ok(IncidentDto.Response.from(updated));
    }

    /**
     * Get incident summary/statistics
     * 
     * For dashboard display
     */
    @GetMapping("/summary")
    @Operation(summary = "Get incident summary statistics")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('PROCTOR', 'ADMIN', 'STUDENT')")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<IncidentDto.SummaryResponse> getSummary(
            @RequestParam(value = "examId", required = false) String examId,
            @RequestParam(value = "sessionId", required = false) UUID sessionId,
            org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken auth
    ) {
        boolean isStudent = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_STUDENT"));
        if (isStudent) {
            UUID userId = UUID.fromString(auth.getToken().getSubject());
            if (sessionId != null) {
                if (!sessionShadowRepository.isSessionOwnedByUser(sessionId, userId)) {
                    throw new org.springframework.security.access.AccessDeniedException("Access Denied");
                }
            } else {
                // If no sessionId is provided by student, we shouldn't really allow summarizing the entire system.
                // We should enforce providing their own sessionId.
                throw new org.springframework.security.access.AccessDeniedException("Student must provide sessionId");
            }
        }

        IncidentDto.SummaryResponse summary = incidentService.getSummary(examId, sessionId);
        return ResponseEntity.ok(summary);
    }

    /**
     * Get incident evidence file (image or video)
     * 
     * Proxies the evidence file from MinIO to bypass presigned URL issues.
     * Supports both images (jpg, png) and videos (mp4, webm).
     */
    @GetMapping("/{id}/evidence")
    @Operation(summary = "Get incident evidence (image or video)")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<byte[]> getEvidence(@PathVariable UUID id) {
        var optIncident = incidentRepository.findById(id);
        
        if (optIncident.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        var incident = optIncident.get();
        if (incident.getObjectKey() == null || incident.getObjectKey().isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        try {
            var inputStream = minioStorageService.getFileStream(incident.getObjectKey());
            byte[] fileBytes = inputStream.readAllBytes();
            inputStream.close();
            
            // Detect content type from file extension
            String contentType = detectContentType(incident.getObjectKey());
            
            return ResponseEntity.ok()
                    .header("Content-Type", contentType)
                    .header("Cache-Control", "max-age=3600")
                    .header("Accept-Ranges", "bytes") // Enable video seeking
                    .body(fileBytes);
        } catch (Exception e) {
            log.error("Failed to load evidence for incident {}", id, e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Detect content type based on file extension
     */
    private String detectContentType(String objectKey) {
        if (objectKey == null) {
            return "application/octet-stream";
        }
        
        String lowerKey = objectKey.toLowerCase();
        
        // Video formats
        if (lowerKey.endsWith(".mp4")) {
            return "video/mp4";
        } else if (lowerKey.endsWith(".webm")) {
            return "video/webm";
        } else if (lowerKey.endsWith(".ogg") || lowerKey.endsWith(".ogv")) {
            return "video/ogg";
        }
        // Image formats
        else if (lowerKey.endsWith(".jpg") || lowerKey.endsWith(".jpeg")) {
            return "image/jpeg";
        } else if (lowerKey.endsWith(".png")) {
            return "image/png";
        } else if (lowerKey.endsWith(".gif")) {
            return "image/gif";
        } else if (lowerKey.endsWith(".webp")) {
            return "image/webp";
        }
        
        // Default
        return "application/octet-stream";
    }

    @Data
    public static class BatchCreateRequest {
        private UUID sessionId;
        private String type;
        private String severity;
        private String evidenceUrl;
        private String objectKey;
        private String detectedBy;
    }

    @PostMapping("/batch/evidence")
    @Operation(summary = "Upload batch incidents")
    public Mono<ResponseEntity<List<IncidentDto.Response>>> uploadEvidenceBatch(
            @Valid @RequestBody List<BatchCreateRequest> requests
    ) {
        return Flux.fromIterable(requests)
                .parallel()
                .runOn(Schedulers.boundedElastic())
                .map(req -> {
                    Incident incident = new Incident();
                    incident.setId(UUID.randomUUID());
                    incident.setSessionId(req.getSessionId());
                    incident.setType(req.getType());
                    incident.setSeverity(req.getSeverity() != null ? req.getSeverity() : "MEDIUM");
                    incident.setEvidenceUrl(req.getEvidenceUrl());
                    incident.setObjectKey(req.getObjectKey() != null ? req.getObjectKey() : req.getEvidenceUrl());
                    incident.setStatus("PENDING");
                    incident.setDetectedBy(req.getDetectedBy() != null ? req.getDetectedBy() : "MANUAL_UPLOAD");
                    incident.setDetectedAt(java.time.Instant.now());
                    incident.setCreatedAt(java.time.Instant.now());
                    return incidentRepository.save(incident);
                })
                .sequential()
                .collectList()
                .map(list -> ResponseEntity.ok(list.stream().map(IncidentDto.Response::from).toList()));
    }

    @PostMapping("/batch/load-evidence")
    @Operation(summary = "Load batch incident evidence files as Base64")
    public Mono<ResponseEntity<Map<String, String>>> loadEvidenceBatch(
            @RequestBody List<UUID> incidentIds
    ) {
        return Flux.fromIterable(incidentIds)
                .parallel()
                .runOn(Schedulers.boundedElastic())
                .flatMap(id -> {
                    return Mono.fromCallable(() -> {
                        var optIncident = incidentRepository.findById(id);
                        if (optIncident.isPresent()) {
                            var incident = optIncident.get();
                            if (incident.getObjectKey() != null && !incident.getObjectKey().isEmpty()) {
                                try (var inputStream = minioStorageService.getFileStream(incident.getObjectKey())) {
                                    byte[] fileBytes = inputStream.readAllBytes();
                                    String base64Data = Base64.getEncoder().encodeToString(fileBytes);
                                    String contentType = detectContentType(incident.getObjectKey());
                                    return Map.entry(id.toString(), "data:" + contentType + ";base64," + base64Data);
                                }
                            }
                        }
                        return Map.entry(id.toString(), "");
                    }).onErrorReturn(Map.entry(id.toString(), ""));
                })
                .sequential()
                .collectList()
                .map(entries -> {
                    Map<String, String> resultMap = new HashMap<>();
                    for (var entry : entries) {
                        if (!entry.getValue().isEmpty()) {
                            resultMap.put(entry.getKey(), entry.getValue());
                        }
                    }
                    return ResponseEntity.ok(resultMap);
                });
    }
}

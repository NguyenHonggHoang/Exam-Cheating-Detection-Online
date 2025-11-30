package com.example.exam.controller;

import com.example.exam.dto.IncidentDto;
import com.example.exam.model.Incident;
import com.example.exam.model.IncidentStatus;
import com.example.exam.repository.IncidentRepository;
import com.example.exam.repository.SessionRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/incidents")
@Tag(name = "Incidents")
public class IncidentController {

    private final IncidentRepository incidentRepository;
    private final SessionRepository sessionRepository;

    public IncidentController(IncidentRepository incidentRepository, SessionRepository sessionRepository) {
        this.incidentRepository = incidentRepository;
        this.sessionRepository = sessionRepository;
    }

    @PostMapping
    @Operation(summary = "Create a new incident")
    public ResponseEntity<?> create(@Valid @RequestBody IncidentDto.CreateRequest req) {
        // session must exist
        if (!sessionRepository.existsById(java.util.Objects.requireNonNull(req.sessionId))) {
            return ResponseEntity.notFound().build();
        }

        Incident entity = new Incident();
        entity.setSessionId(req.sessionId);
        entity.setTs(req.ts);
        entity.setType(req.type);
        entity.setScore(req.score);
        entity.setReason(req.reason);
        entity.setEvidenceUrl(req.evidenceUrl);
        entity.setStatus(IncidentStatus.OPEN);
        entity.setCreatedAt(Instant.now());

        Incident saved = incidentRepository.save(entity);
        return ResponseEntity.ok(IncidentDto.Response.from(saved));
    }

    @GetMapping
    @Operation(summary = "List incidents, optionally by sessionId with pagination & sort")
    public ResponseEntity<?> list(
            @RequestParam(value = "sessionId", required = false) UUID sessionId,
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "size", required = false) Integer size,
            @RequestParam(value = "sort", required = false) String sort
    ) {
        // Backward-compatible path (no pagination params): keep previous behavior and ordering
        if (page == null && size == null && sort == null) {
            if (sessionId == null) {
                var incidents = incidentRepository.findAll();
                return ResponseEntity.ok(incidents.stream().map(IncidentDto.Response::from).toList());
            } else {
                var incidents = incidentRepository.findBySessionIdOrderByTsAsc(sessionId);
                return ResponseEntity.ok(incidents.stream().map(IncidentDto.Response::from).toList());
            }
        }

        // New pagination path
        String sortExpr = (sort == null || sort.isBlank()) ? "ts,desc" : sort;
        String[] sortParts = sortExpr.split(",");
        String sortProp = sortParts[0];
        Sort.Direction dir = (sortParts.length > 1 && sortParts[1].equalsIgnoreCase("asc")) ? Sort.Direction.ASC : Sort.Direction.DESC;

        int p = (page == null) ? 0 : page;
        int s = (size == null) ? 20 : size;
        Pageable pageable = PageRequest.of(p, s, Sort.by(dir, sortProp));

        if (sessionId == null) {
            Page<Incident> pageData = incidentRepository.findAll(pageable);
            return ResponseEntity.ok(pageData.map(IncidentDto.Response::from));
        } else {
            Page<Incident> pageData = incidentRepository.findBySessionId(sessionId, pageable);
            return ResponseEntity.ok(pageData.map(IncidentDto.Response::from));
        }
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get incident by id")
    public ResponseEntity<IncidentDto.Response> get(@PathVariable("id") UUID id) {
    Optional<Incident> opt = incidentRepository.findById(java.util.Objects.requireNonNull(id));
        return opt.map(incident -> ResponseEntity.ok(IncidentDto.Response.from(incident)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}

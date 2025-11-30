package com.example.exam.service;

import com.example.exam.dto.EventIngestDto;
import com.example.exam.dto.SnapshotIngestDto;
import com.example.exam.dto.SnapshotMessage;
import com.example.exam.model.Event;
import com.example.exam.model.EventType;
import com.example.exam.model.MediaSnapshot;
import com.example.exam.repository.EventRepository;
import com.example.exam.repository.MediaSnapshotRepository;
import com.example.exam.repository.SessionRepository;
import com.example.exam.config.RabbitMQConfig;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class IngestService {
    private final SessionRepository sessionRepository;
    private final EventRepository eventRepository;
    private final MediaSnapshotRepository snapshotRepository;
    private final RuleService ruleService;
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper mapper = new ObjectMapper();
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(IngestService.class);

    public IngestService(SessionRepository sessionRepository,
                         EventRepository eventRepository,
                         MediaSnapshotRepository snapshotRepository,
                         RuleService ruleService,
                         RabbitTemplate rabbitTemplate) {
        this.sessionRepository = sessionRepository;
        this.eventRepository = eventRepository;
        this.snapshotRepository = snapshotRepository;
        this.ruleService = ruleService;
        this.rabbitTemplate = rabbitTemplate;
    }

    @Transactional
    public EventIngestDto.Result ingestEvents(EventIngestDto.Request req) {
        int created = 0;
        int dup = 0;
        List<UUID> ids = new ArrayList<>();

        for (var item : req.items) {
            // Validate session existence (defensive null guard)
            var sessionId = item.sessionId;
            if (sessionId == null || !sessionRepository.existsById(sessionId)) {
                // Skip invalid session; alternatively could throw 404
                continue;
            }

            // Check dedupe by idempotency key first
            var existing = eventRepository.findByIdempotencyKey(item.idempotencyKey);
            if (existing.isPresent()) {
                dup++;
                ids.add(existing.get().getId());
                continue;
            }

            // Also check composite unique key (sessionId, ts, eventType)
            var existingComposite = eventRepository.findBySessionIdAndTsAndEventType(sessionId, item.ts, item.eventType);
            if (existingComposite.isPresent()) {
                dup++;
                ids.add(existingComposite.get().getId());
                continue;
            }

            // Validate JSON in details if provided (avoid DB jsonb parse errors)
            if (item.details != null) {
                try {
                    mapper.readTree(item.details);
                } catch (Exception ex) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid JSON in 'details'");
                }
            }

            Event e = new Event();
            e.setSessionId(sessionId);
            e.setTs(item.ts);
            e.setEventType(item.eventType);
            e.setDetails(item.details);
            e.setIdempotencyKey(item.idempotencyKey);
            e.setCreatedAt(Instant.now());

            try {
                e = eventRepository.save(e);
                created++;
                ids.add(e.getId());
                
                // Evaluate rules after saving event
                if (item.eventType == EventType.TAB_SWITCH) {
                    ruleService.evaluateTabSwitch(sessionId, Instant.ofEpochMilli(item.ts));
                } else if (item.eventType == EventType.PASTE) {
                    ruleService.evaluatePaste(sessionId, Instant.ofEpochMilli(item.ts));
                }
            } catch (DataIntegrityViolationException ex) {
                // Safety net: treat DB unique violations as duplicates instead of 500
                var maybe = eventRepository.findBySessionIdAndTsAndEventType(sessionId, item.ts, item.eventType)
                        .or(() -> eventRepository.findByIdempotencyKey(item.idempotencyKey));
                if (maybe.isPresent()) {
                    dup++;
                    ids.add(maybe.get().getId());
                    log.debug("Ingest duplicate detected via integrity violation: {}", item.idempotencyKey);
                } else {
                    log.error("Unexpected data integrity error ingesting event: sessionId={}, ts={}, type={}, key={}",
                            sessionId, item.ts, item.eventType, item.idempotencyKey, ex);
                    throw ex; // unknown integrity issue: propagate
                }
            } catch (Exception ex) {
                log.error("Unhandled exception saving event: sessionId={}, ts={}, type={}, key={} -> {}", sessionId, item.ts, item.eventType, item.idempotencyKey, ex.getMessage(), ex);
                throw ex; // Let global handler turn into 500; log gives diagnostics
            }
        }

        return new EventIngestDto.Result(created, dup, ids);
    }

    @Transactional
    public SnapshotIngestDto.Result ingestSnapshots(SnapshotIngestDto.Request req) {
        int created = 0;
        int dup = 0;
        List<UUID> ids = new ArrayList<>();

        for (var item : req.items) {
            var sessionId = item.sessionId;
            if (sessionId == null || !sessionRepository.existsById(sessionId)) {
                continue;
            }

            var existing = snapshotRepository.findByIdempotencyKey(item.idempotencyKey);
            if (existing.isPresent()) {
                dup++;
                ids.add(existing.get().getId());
                continue;
            }

            MediaSnapshot s = new MediaSnapshot();
            s.setSessionId(sessionId);
            s.setTs(item.ts);
            s.setObjectKey(item.objectKey);
            s.setFileSize(item.fileSize);
            s.setMimeType(item.mimeType);
            s.setUploadedAt(Instant.now());
            s.setFaceCount(item.faceCount);
            s.setIdempotencyKey(item.idempotencyKey);

            s = snapshotRepository.save(s);
            created++;
            ids.add(s.getId());
            
            // Publish message to RabbitMQ for async processing
            try {
                SnapshotMessage message = new SnapshotMessage(
                    s.getId(),
                    s.getSessionId(),
                    s.getObjectKey(),
                    s.getTs()
                );
                rabbitTemplate.convertAndSend(
                    RabbitMQConfig.EXCHANGE_NAME,
                    RabbitMQConfig.ROUTING_KEY,
                    message
                );
                log.info("Published snapshot message to queue: snapshotId={}, sessionId={}", s.getId(), s.getSessionId());
            } catch (Exception ex) {
                // Log but don't fail the request - worker will process eventually
                log.error("Failed to publish snapshot message: snapshotId={}, error={}", s.getId(), ex.getMessage(), ex);
            }
        }

        return new SnapshotIngestDto.Result(created, dup, ids);
    }
}

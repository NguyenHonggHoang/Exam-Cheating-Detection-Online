package com.example.exam.controller;

import com.example.exam.dto.ClientEventRequest;
import com.example.exam.service.ClientEventService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Client Event Controller - Incident Service
 * 
 * Receives violation events from frontend AI detection
 * 
 * Endpoint: POST /api/incident/client-event
 */
@RestController
@RequestMapping("/api/incident")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:3000"})
public class ClientEventController {

    private static final Logger log = LoggerFactory.getLogger(ClientEventController.class);

    private final ClientEventService clientEventService;

    /**
     * Receive client-side AI detection event
     * 
     * Flow:
     * 1. Frontend detects violation via TensorFlow
     * 2. Frontend uploads evidence to MinIO
     * 3. Frontend sends this event with evidence URL
     * 4. Incident Service creates incident record
     * 5. Optional: Trigger AI worker for server-side analysis
     * 
     * @param request Client event with evidence metadata
     * @return 200 OK if processed successfully
     */
    @PostMapping("/client-event")
    public ResponseEntity<Void> receiveClientEvent(@RequestBody ClientEventRequest request) {
        // Debug: Log all request fields
        log.info("Received client event: sessionId={}, type={}, violation={}, evidenceUrl={}", 
            request.getSessionId(), 
            request.getEventType(), 
            request.getViolationType(),
            request.getEvidenceUrl() != null ? request.getEvidenceUrl().substring(0, Math.min(50, request.getEvidenceUrl().length())) + "..." : "null");

        try {
            // Validate request - log detailed info for debugging
            if (request.getSessionId() == null) {
                log.warn("Client event missing sessionId. Full request: eventType={}, violationType={}", 
                    request.getEventType(), request.getViolationType());
                return ResponseEntity.badRequest().build();
            }

            // Evidence URL is required only for snapshot/clip events, not browser events
            boolean isEvidenceEvent = request.getEventType() != null && 
                (request.getEventType().contains("SNAPSHOT") || request.getEventType().contains("CLIP"));
            
            if (isEvidenceEvent && (request.getEvidenceUrl() == null || request.getEvidenceUrl().isEmpty())) {
                log.warn("Evidence event missing evidenceUrl");
                return ResponseEntity.badRequest().build();
            }

            // Process event
            clientEventService.processClientEvent(request);

            log.info("Client event processed successfully: sessionId={}, type={}", 
                request.getSessionId(), request.getEventType());

            return ResponseEntity.ok().build();

        } catch (Exception e) {
            log.error("Failed to process client event: sessionId={}", request.getSessionId(), e);
            return ResponseEntity.internalServerError().build();
        }
    }
}

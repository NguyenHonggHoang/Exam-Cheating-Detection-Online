package com.example.exam.controller;

import com.example.exam.dto.ClientEventRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
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

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Receive client-side AI detection event
     * 
     * Flow:
     * 1. Frontend detects violation via TensorFlow
     * 2. Frontend uploads evidence to MinIO
     * 3. Frontend sends this event with evidence URL
     * 4. Controller publishes event to Kafka for async batch processing
     * 
     * @param request Client event with evidence metadata
     * @return 202 Accepted if published successfully
     */
    @PostMapping("/client-event")
    public ResponseEntity<Void> receiveClientEvent(@RequestBody ClientEventRequest request) {
        log.info("Received client event for ingestion: sessionId={}, type={}", 
            request.getSessionId(), request.getEventType());

        try {
            if (request.getSessionId() == null) {
                log.warn("Client event missing sessionId");
                return ResponseEntity.badRequest().build();
            }

            // Publish to Kafka topic 'incident-client-events'
            String json = objectMapper.writeValueAsString(request);
            kafkaTemplate.send("incident-client-events", request.getSessionId().toString(), json);

            log.info("Client event successfully published to Kafka: sessionId={}", request.getSessionId());
            return ResponseEntity.accepted().build();

        } catch (Exception e) {
            log.error("Failed to publish client event to Kafka: sessionId={}", request.getSessionId(), e);
            return ResponseEntity.internalServerError().build();
        }
    }
}

package com.example.exam.messaging;

import com.example.exam.dto.ClientEventRequest;
import com.example.exam.service.ClientEventService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Kafka Consumer for Client Event Telemetry.
 * 
 * Consumes client events from the 'incident-client-events' topic in batches
 * using the configured batch listener container factory. Processes and saves
 * the events to the database as a single bulk operation.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ClientEventConsumer {

    private final ClientEventService clientEventService;
    private final ObjectMapper objectMapper;

    @KafkaListener(
            topics = "incident-client-events",
            groupId = "incident-service-client-events",
            containerFactory = "batchKafkaListenerContainerFactory"
    )
    public void consumeBatch(List<String> messages) {
        log.info("Received batch of {} client events from Kafka for processing", messages.size());
        List<ClientEventRequest> requests = new ArrayList<>();
        
        for (String msg : messages) {
            try {
                ClientEventRequest request = objectMapper.readValue(msg, ClientEventRequest.class);
                requests.add(request);
            } catch (Exception e) {
                log.error("Failed to deserialize client event JSON message: {}", msg, e);
            }
        }

        if (!requests.isEmpty()) {
            try {
                clientEventService.processClientEventsBatch(requests);
                log.info("Successfully processed batch of {} client events", requests.size());
            } catch (Exception e) {
                log.error("Failed to process batch of client events inside transaction", e);
            }
        }
    }
}

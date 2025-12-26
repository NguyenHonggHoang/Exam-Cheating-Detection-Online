package com.example.exam.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ Configuration for async processing
 * 
 * Architecture:
 * - Exchange: exam.events (topic)
 * - Queues:
 *   - snapshot.process: Snapshot processing (face detection)
 *   - incident.create: Incident events for incident-service
 *   - video.analysis: Video clips for Python AI worker (YOLO detection)
 *   - face.verification: Identity verification requests (Python AI worker)
 *   - face.verification.result: Verification results back to Java
 * 
 * Flow:
 * 1. IngestService uploads snapshot → publishes to snapshot.process
 * 2. FaceDetectionWorker processes → publishes incident events to incident.create
 * 3. incident-service consumes incident events and persists
 * 4. Frontend TF.js detects violation → uploads clip → publishes to video.analysis
 * 5. Python AI Worker consumes video.analysis → YOLO detection → publishes to ai.violations
 * 6. Identity verification: Student uploads ID → exam start capture → face.verification → AI compares → face.verification.result
 */
@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE_NAME = "exam.events";
    public static final String QUEUE_NAME = "snapshot.process";
    public static final String ROUTING_KEY = "snapshot.uploaded";
    
    // Incident events routing (session-service → incident-service)
    public static final String INCIDENT_QUEUE = "incident.create";
    public static final String INCIDENT_ROUTING_KEY = "incident.detected";
    
    // Video analysis routing (session-service → Python AI worker)
    public static final String VIDEO_ANALYSIS_QUEUE = "video.analysis";
    public static final String VIDEO_ANALYSIS_ROUTING_KEY = "video.uploaded";
    
    // Face verification routing (Java → Python AI worker → Java)
    public static final String FACE_VERIFICATION_QUEUE = "face.verification";
    public static final String FACE_VERIFICATION_ROUTING_KEY = "face.verification.request";
    public static final String FACE_VERIFICATION_RESULT_QUEUE = "face.verification.result";
    public static final String FACE_VERIFICATION_RESULT_ROUTING_KEY = "face.verification.result";
    
    // Pre-suspicion analysis result routing (Python AI worker → Java)
    public static final String PRE_SUSPICION_RESULT_QUEUE = "pre_suspicion_results";
    public static final String PRE_SUSPICION_RESULT_ROUTING_KEY = "analysis.pre_suspicion.result";

    /**
     * Topic exchange for exam events
     */
    @Bean
    public TopicExchange examEventsExchange() {
        return new TopicExchange(EXCHANGE_NAME, true, false);
    }

    /**
     * Queue for snapshot processing
     * Durable: Messages survive broker restart
     */
    @Bean
    public Queue snapshotProcessQueue() {
        return QueueBuilder.durable(QUEUE_NAME)
                .build();
    }
    
    /**
     * Queue for incident events (consumed by incident-service)
     */
    @Bean
    public Queue incidentCreateQueue() {
        return QueueBuilder.durable(INCIDENT_QUEUE)
                .build();
    }
    
    /**
     * Queue for video analysis (consumed by Python AI worker)
     * Videos are analyzed for headphones, phones, objects using YOLO
     */
    @Bean
    public Queue videoAnalysisQueue() {
        return QueueBuilder.durable(VIDEO_ANALYSIS_QUEUE)
                .build();
    }

    /**
     * Bind queue to exchange with routing key
     */
    @Bean
    public Binding snapshotProcessBinding(Queue snapshotProcessQueue, TopicExchange examEventsExchange) {
        return BindingBuilder
                .bind(snapshotProcessQueue)
                .to(examEventsExchange)
                .with(ROUTING_KEY);
    }
    
    /**
     * Bind incident queue to exchange
     */
    @Bean
    public Binding incidentCreateBinding(Queue incidentCreateQueue, TopicExchange examEventsExchange) {
        return BindingBuilder
                .bind(incidentCreateQueue)
                .to(examEventsExchange)
                .with(INCIDENT_ROUTING_KEY);
    }
    
    /**
     * Bind video analysis queue to exchange
     */
    @Bean
    public Binding videoAnalysisBinding(Queue videoAnalysisQueue, TopicExchange examEventsExchange) {
        return BindingBuilder
                .bind(videoAnalysisQueue)
                .to(examEventsExchange)
                .with(VIDEO_ANALYSIS_ROUTING_KEY);
    }
    
    /**
     * Queue for face verification requests (consumed by Python AI worker)
     */
    @Bean
    public Queue faceVerificationQueue() {
        return QueueBuilder.durable(FACE_VERIFICATION_QUEUE)
                .build();
    }
    
    /**
     * Queue for face verification results (consumed by Java backend)
     */
    @Bean
    public Queue faceVerificationResultQueue() {
        return QueueBuilder.durable(FACE_VERIFICATION_RESULT_QUEUE)
                .build();
    }
    
    /**
     * Bind face verification queue to exchange
     */
    @Bean
    public Binding faceVerificationBinding(Queue faceVerificationQueue, TopicExchange examEventsExchange) {
        return BindingBuilder
                .bind(faceVerificationQueue)
                .to(examEventsExchange)
                .with(FACE_VERIFICATION_ROUTING_KEY);
    }
    
    /**
     * Bind face verification result queue to exchange
     */
    @Bean
    public Binding faceVerificationResultBinding(Queue faceVerificationResultQueue, TopicExchange examEventsExchange) {
        return BindingBuilder
                .bind(faceVerificationResultQueue)
                .to(examEventsExchange)
                .with(FACE_VERIFICATION_RESULT_ROUTING_KEY);
    }
    
    /**
     * Queue for pre-suspicion analysis results (from Python AI worker)
     */
    @Bean
    public Queue preSuspicionResultQueue() {
        return QueueBuilder.durable(PRE_SUSPICION_RESULT_QUEUE)
                .build();
    }
    
    /**
     * Bind pre-suspicion result queue to exchange
     */
    @Bean
    public Binding preSuspicionResultBinding(Queue preSuspicionResultQueue, TopicExchange examEventsExchange) {
        return BindingBuilder
                .bind(preSuspicionResultQueue)
                .to(examEventsExchange)
                .with(PRE_SUSPICION_RESULT_ROUTING_KEY);
    }

    /**
     * JSON message converter for DTOs
     */
    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    /**
     * RabbitTemplate with JSON converter
     */
    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter());
        return template;
    }
}

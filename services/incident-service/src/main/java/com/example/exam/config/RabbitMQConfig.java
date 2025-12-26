package com.example.exam.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ Configuration for Incident Service
 * 
 * Queues consumed:
 * - ai.violations: From Python AI workers
 * - incident.create: From session-service (face detection, rule engine)
 */
@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE_NAME = "exam.events";
    
    // Queue for AI worker violations
    public static final String AI_VIOLATIONS_QUEUE = "ai.violations";
    public static final String AI_VIOLATIONS_ROUTING_KEY = "ai.violation.detected";
    
    // Queue for session-service incident events
    public static final String INCIDENT_CREATE_QUEUE = "incident.create";
    public static final String INCIDENT_ROUTING_KEY = "incident.detected";

    /**
     * Topic exchange for exam events
     */
    @Bean
    public TopicExchange examEventsExchange() {
        return new TopicExchange(EXCHANGE_NAME, true, false);
    }

    /**
     * Queue for AI worker violations
     */
    @Bean
    public Queue aiViolationsQueue() {
        return QueueBuilder.durable(AI_VIOLATIONS_QUEUE)
                .build();
    }
    
    /**
     * Queue for session-service incident events
     */
    @Bean
    public Queue incidentCreateQueue() {
        return QueueBuilder.durable(INCIDENT_CREATE_QUEUE)
                .build();
    }

    /**
     * Bind AI violations queue to exchange
     */
    @Bean
    public Binding aiViolationsBinding(Queue aiViolationsQueue, TopicExchange examEventsExchange) {
        return BindingBuilder
                .bind(aiViolationsQueue)
                .to(examEventsExchange)
                .with(AI_VIOLATIONS_ROUTING_KEY);
    }
    
    /**
     * Bind incident create queue to exchange
     */
    @Bean
    public Binding incidentCreateBinding(Queue incidentCreateQueue, TopicExchange examEventsExchange) {
        return BindingBuilder
                .bind(incidentCreateQueue)
                .to(examEventsExchange)
                .with(INCIDENT_ROUTING_KEY);
    }
    
    // ========== AI Video Result Queue (from UnifiedVideoWorker) ==========
    
    public static final String AI_VIDEO_RESULT_QUEUE = "ai.result.video";
    public static final String AI_VIDEO_RESULT_ROUTING_KEY = "ai.result.video";
    
    /**
     * Queue for AI video analysis results from UnifiedVideoWorker
     */
    @Bean
    public Queue aiVideoResultQueue() {
        return QueueBuilder.durable(AI_VIDEO_RESULT_QUEUE)
                .build();
    }
    
    /**
     * Bind AI video result queue to exchange
     */
    @Bean
    public Binding aiVideoResultBinding(Queue aiVideoResultQueue, TopicExchange examEventsExchange) {
        return BindingBuilder
                .bind(aiVideoResultQueue)
                .to(examEventsExchange)
                .with(AI_VIDEO_RESULT_ROUTING_KEY);
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

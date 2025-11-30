package com.example.exam.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ Configuration for async snapshot processing
 * 
 * Architecture:
 * - Exchange: exam.events (topic)
 * - Queue: snapshot.process
 * - Routing Key: snapshot.uploaded
 * 
 * Flow:
 * 1. IngestService uploads snapshot → publishes message
 * 2. Worker listens to queue → processes snapshot
 * 3. Worker updates face_count + creates incidents
 */
@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE_NAME = "exam.events";
    public static final String QUEUE_NAME = "snapshot.process";
    public static final String ROUTING_KEY = "snapshot.uploaded";

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

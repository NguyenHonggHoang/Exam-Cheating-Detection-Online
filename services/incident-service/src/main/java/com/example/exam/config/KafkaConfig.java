package com.example.exam.config;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.*;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.serializer.ErrorHandlingDeserializer;
import org.springframework.util.backoff.FixedBackOff;

import java.util.HashMap;
import java.util.Map;

/**
 * Kafka Configuration for Incident Service
 * 
 * Features:
 * - Error handling with Dead Letter Queue
 * - Retry mechanism for transient failures
 * - Idempotent consumption
 */
@Configuration
@EnableKafka
public class KafkaConfig {

    @Value("${spring.kafka.bootstrap-servers:localhost:9092}")
    private String bootstrapServers;

    @Value("${spring.kafka.consumer.group-id:incident-service}")
    private String groupId;

    /**
     * Consumer Factory with Error Handling
     */
    @Bean
    public ConsumerFactory<String, String> consumerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, groupId);
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        
        // Enable idempotent consumption
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
        props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 100);
        
        // Error handling deserializer
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, ErrorHandlingDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, ErrorHandlingDeserializer.class);
        props.put(ErrorHandlingDeserializer.KEY_DESERIALIZER_CLASS, StringDeserializer.class);
        props.put(ErrorHandlingDeserializer.VALUE_DESERIALIZER_CLASS, StringDeserializer.class);
        
        return new DefaultKafkaConsumerFactory<>(props);
    }

    /**
     * Producer Factory for DLQ
     */
    @Bean
    public ProducerFactory<String, String> producerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        
        // High performance producer configuration for telemetry
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, false);
        props.put(ProducerConfig.ACKS_CONFIG, "1");
        props.put(ProducerConfig.RETRIES_CONFIG, 3);
        props.put(ProducerConfig.LINGER_MS_CONFIG, 5); // 5ms delay to batch events
        props.put(ProducerConfig.BATCH_SIZE_CONFIG, 32768); // 32KB batch size
        
        return new DefaultKafkaProducerFactory<>(props);
    }

    @Bean
    public KafkaTemplate<String, String> kafkaTemplate() {
        return new KafkaTemplate<>(producerFactory());
    }

    /**
     * Kafka Listener Container Factory with DLQ
     */
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, String> kafkaListenerContainerFactory(
            KafkaTemplate<String, String> kafkaTemplate
    ) {
        ConcurrentKafkaListenerContainerFactory<String, String> factory = 
            new ConcurrentKafkaListenerContainerFactory<>();
        
        factory.setConsumerFactory(consumerFactory());
        
        // Manual commit for better control
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.RECORD);
        
        // Error Handler with Retry + DLQ
        DefaultErrorHandler errorHandler = new DefaultErrorHandler(
            new DeadLetterPublishingRecoverer(kafkaTemplate),
            new FixedBackOff(1000L, 3L) // Retry 3 times with 1 second delay
        );
        
        // Don't retry for certain exceptions
        errorHandler.addNotRetryableExceptions(
            com.fasterxml.jackson.core.JsonParseException.class,
            org.springframework.kafka.support.serializer.DeserializationException.class
        );
        
        factory.setCommonErrorHandler(errorHandler);
        
        return factory;
    }

    /**
     * Concurrent Kafka Listener Container Factory for batch processing
     */
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, String> batchKafkaListenerContainerFactory(
            KafkaTemplate<String, String> kafkaTemplate
    ) {
        ConcurrentKafkaListenerContainerFactory<String, String> factory = 
            new ConcurrentKafkaListenerContainerFactory<>();
        
        factory.setConsumerFactory(consumerFactory());
        factory.setBatchListener(true); // Enable batch listener mode
        
        // Commit after processing the whole batch
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.BATCH);
        
        // Reuse common error handler for batch recovery if needed
        DefaultErrorHandler errorHandler = new DefaultErrorHandler(
            new DeadLetterPublishingRecoverer(kafkaTemplate),
            new FixedBackOff(1000L, 3L)
        );
        errorHandler.addNotRetryableExceptions(
            com.fasterxml.jackson.core.JsonParseException.class,
            org.springframework.kafka.support.serializer.DeserializationException.class
        );
        factory.setCommonErrorHandler(errorHandler);
        
        return factory;
    }
}

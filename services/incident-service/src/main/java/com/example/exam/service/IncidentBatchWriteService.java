package com.example.exam.service;

import com.example.exam.model.Incident;
import com.example.exam.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Incident Batch Write Service
 *
 * <p>High-throughput write buffer for incident inserts.
 *
 * <p>Problem: At peak load (thousands of concurrent exam sessions), individual
 * {@code incidentRepository.save()} calls create one DB round-trip per incident,
 * easily saturating the primary datasource.
 *
 * <p>Solution: Buffer incoming {@link Incident} objects in a lock-free
 * {@link ConcurrentLinkedQueue} and flush them periodically (every 500 ms) using
 * {@code saveAll()} which translates to a single JDBC batch INSERT statement
 * (requires {@code spring.jpa.properties.hibernate.jdbc.batch_size} to be set).
 *
 * <p>Safety valve: if the buffer grows beyond {@code MAX_BUFFER_SIZE} the flush
 * is triggered immediately inside {@link #enqueue} to prevent unbounded memory
 * growth.
 *
 * <p>SSE broadcasting is NOT done inside this service — callers are responsible
 * for broadcasting after calling {@link #enqueue} (or they can ignore it for
 * fire-and-forget paths like RabbitMQ consumers).
 */
@Service
@RequiredArgsConstructor
public class IncidentBatchWriteService {

    private static final Logger log = LoggerFactory.getLogger(IncidentBatchWriteService.class);

    /**
     * Maximum number of incidents to buffer before triggering an immediate flush.
     * Prevents unbounded memory growth under extreme load spikes.
     */
    private static final int MAX_BUFFER_SIZE = 10000;

    private final IncidentRepository incidentRepository;

    /**
     * Lock-free queue safe for concurrent producers (REST threads, RabbitMQ listeners, etc.)
     */
    private final ConcurrentLinkedQueue<Incident> buffer = new ConcurrentLinkedQueue<>();

    /**
     * Approximate size tracker (cheaper than {@code buffer.size()} which is O(n)).
     */
    private final AtomicInteger bufferSize = new AtomicInteger(0);

    private final java.util.concurrent.atomic.AtomicBoolean isFlushing = new java.util.concurrent.atomic.AtomicBoolean(false);

    // ===========================  PUBLIC API  ===========================

    /**
     * Enqueue an incident for batch write.
     *
     * <p>If the buffer has grown past {@link #MAX_BUFFER_SIZE}, an immediate
     * synchronous flush is performed <em>before</em> the new incident is added
     * so that the caller does not see unbounded latency.
     *
     * @param incident the fully-populated incident to persist (must have a non-null id)
     */
    public void enqueue(Incident incident) {
        buffer.offer(incident);
        bufferSize.incrementAndGet();
        
        // Safety valve: flush if buffer is at capacity
        if (bufferSize.get() >= MAX_BUFFER_SIZE) {
            if (isFlushing.compareAndSet(false, true)) {
                try {
                    log.warn("[BatchWrite] Buffer at capacity ({}), triggering immediate flush", MAX_BUFFER_SIZE);
                    flush();
                } finally {
                    isFlushing.set(false);
                }
            }
        }
        
        log.debug("[BatchWrite] Enqueued incident id={}, type={}, buffer size={}",
                incident.getId(), incident.getType(), bufferSize.get());
    }

    /**
     * Scheduled flush called every 500 ms by {@link com.example.exam.config.SchedulerConfig}.
     */
    public void flush() {
        if (buffer.isEmpty()) {
            return;
        }

        // Drain the entire queue into a local list atomically
        List<Incident> batch = new ArrayList<>();
        Incident incident;
        while ((incident = buffer.poll()) != null) {
            batch.add(incident);
        }
        
        // Decrement counter by the number we actually drained
        bufferSize.addAndGet(-batch.size());

        if (batch.isEmpty()) {
            return;
        }

        try {
            List<Incident> saved = incidentRepository.saveAll(batch);
            log.info("[BatchWrite] Flushed {} incidents to DB (JDBC batch INSERT)", saved.size());
        } catch (Exception e) {
            // On failure, re-enqueue incidents so they are retried on the next flush
            log.error("[BatchWrite] Batch flush failed ({} incidents), re-enqueuing for retry: {}",
                    batch.size(), e.getMessage(), e);
            batch.forEach(i -> {
                buffer.offer(i);
                bufferSize.incrementAndGet();
            });
        }
    }

    /**
     * Returns the approximate number of incidents currently buffered.
     * Useful for health-check endpoints.
     */
    public int pendingCount() {
        return bufferSize.get();
    }
}

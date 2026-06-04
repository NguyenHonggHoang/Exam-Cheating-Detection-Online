package com.example.exam.config;

import com.example.exam.service.IncidentBatchWriteService;
import com.example.exam.service.SseEmitterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
@EnableScheduling
@RequiredArgsConstructor
@Slf4j
public class SchedulerConfig {

    private final SseEmitterService sseEmitterService;
    private final IncidentBatchWriteService incidentBatchWriteService;

    /**
     * Send heartbeat every 25 seconds to keep SSE connections alive.
     * Most proxies/load balancers timeout after 30-60s of inactivity.
     */
    @Scheduled(fixedRate = 25000)
    public void scheduleHeartbeat() {
        sseEmitterService.sendHeartbeat();
    }

    /**
     * Flush incident write buffer to DB every 500 ms.
     *
     * Uses fixedDelay (not fixedRate) so the next flush only starts 500 ms
     * AFTER the previous one completes — preventing overlapping DB writes
     * when the batch is large or the DB is temporarily slow.
     *
     * At peak load (tens of thousands of req/s) the safety valve in
     * IncidentBatchWriteService.enqueue() triggers immediate flushes
     * when the buffer exceeds MAX_BUFFER_SIZE (1000 items).
     */
    @Scheduled(fixedDelay = 500)
    public void flushIncidentBuffer() {
        try {
            incidentBatchWriteService.flush();
        } catch (Exception e) {
            // flush() already handles re-enqueue on failure; log here for monitoring
            log.error("[Scheduler] Unexpected error during incident buffer flush", e);
        }
    }
}

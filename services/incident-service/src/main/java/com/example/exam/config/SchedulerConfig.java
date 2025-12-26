package com.example.exam.config;

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

    /**
     * Send heartbeat every 25 seconds to keep SSE connections alive.
     * Most proxies/load balancers timeout after 30-60s of inactivity.
     */
    @Scheduled(fixedRate = 25000)
    public void scheduleHeartbeat() {
        sseEmitterService.sendHeartbeat();
    }
}

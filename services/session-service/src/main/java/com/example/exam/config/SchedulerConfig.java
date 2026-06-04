package com.example.exam.config;

import com.example.exam.service.SubmissionBatchWriteService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
@EnableScheduling
public class SchedulerConfig {

    private static final Logger log = LoggerFactory.getLogger(SchedulerConfig.class);

    private final SubmissionBatchWriteService submissionBatchWriteService;

    public SchedulerConfig(SubmissionBatchWriteService submissionBatchWriteService) {
        this.submissionBatchWriteService = submissionBatchWriteService;
    }

    /**
     * Flush exam submission write buffer to DB every 500 ms.
     */
    @Scheduled(fixedDelay = 500)
    public void flushSubmissionBuffer() {
        try {
            submissionBatchWriteService.flush();
        } catch (Exception e) {
            log.error("[Scheduler] Unexpected error during exam submission buffer flush", e);
        }
    }
}

package com.example.exam.service;

import com.example.exam.model.ExamSessionState;
import com.example.exam.model.Session;
import com.example.exam.repository.ExamSessionStateRepository;
import com.example.exam.repository.SessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class SubmissionBatchWriteService {

    private static final Logger log = LoggerFactory.getLogger(SubmissionBatchWriteService.class);

    private static final int MAX_BUFFER_SIZE = 1000;

    private final SubmissionBatchPersister persister;

    public SubmissionBatchWriteService(SubmissionBatchPersister persister) {
        this.persister = persister;
    }

    public static class PendingSubmission {
        private final Session session;
        private final ExamSessionState state;

        public PendingSubmission(Session session, ExamSessionState state) {
            this.session = session;
            this.state = state;
        }

        public Session getSession() {
            return session;
        }

        public ExamSessionState getState() {
            return state;
        }
    }

    private final ConcurrentLinkedQueue<PendingSubmission> buffer = new ConcurrentLinkedQueue<>();
    private final AtomicInteger bufferSize = new AtomicInteger(0);

    public void enqueue(Session session, ExamSessionState state) {
        if (bufferSize.get() >= MAX_BUFFER_SIZE) {
            log.warn("[BatchSubmit] Buffer at capacity ({}), triggering immediate flush", MAX_BUFFER_SIZE);
            flush();
        }
        buffer.offer(new PendingSubmission(session, state));
        bufferSize.incrementAndGet();
        log.debug("[BatchSubmit] Enqueued submission for session id={}, buffer size≈{}",
                session.getId(), bufferSize.get());
    }

    public void flush() {
        if (buffer.isEmpty()) {
            return;
        }

        List<PendingSubmission> batch = new ArrayList<>();
        PendingSubmission item;
        while ((item = buffer.poll()) != null) {
            batch.add(item);
        }
        bufferSize.addAndGet(-batch.size());

        if (batch.isEmpty()) {
            return;
        }

        List<Session> sessions = new ArrayList<>();
        List<ExamSessionState> states = new ArrayList<>();
        for (PendingSubmission sub : batch) {
            sessions.add(sub.getSession());
            states.add(sub.getState());
        }

        try {
            persister.saveBatch(sessions, states);
            log.info("[BatchSubmit] ✅ Flushed {} exam submissions (sessions & states) to DB", batch.size());
        } catch (Exception e) {
            if (isConnectionException(e)) {
                log.error("[BatchSubmit] ❌ Database connection failure during batch flush ({} submissions), re-enqueuing all for retry: {}",
                        batch.size(), e.getMessage());
                batch.forEach(sub -> {
                    buffer.offer(sub);
                    bufferSize.incrementAndGet();
                });
            } else {
                log.warn("[BatchSubmit] ⚠️ Batch flush failed due to data constraint/integrity issue ({} submissions): {}. Attempting fallback to individual saves.",
                        batch.size(), e.getMessage());
                
                // Fallback: save individually to isolate and discard faulty records
                int successCount = 0;
                int failCount = 0;
                for (PendingSubmission sub : batch) {
                    try {
                        persister.saveIndividual(sub.getSession(), sub.getState());
                        successCount++;
                    } catch (Exception ex) {
                        failCount++;
                        log.error("[BatchSubmit] 🚫 Permanent write failure for session id={}, state id={}. Discarding faulty submission record. Error: {}",
                                sub.getSession().getId(), sub.getState().getId(), ex.getMessage());
                    }
                }
                log.info("[BatchSubmit] 🔄 Fallback complete. Individual writes: {} succeeded, {} failed (discarded).", 
                        successCount, failCount);
            }
        }
    }

    private boolean isConnectionException(Throwable t) {
        while (t != null) {
            String msg = t.getMessage();
            if (msg != null) {
                msg = msg.toLowerCase();
                if (msg.contains("connection") || msg.contains("refused") || msg.contains("timeout")
                        || msg.contains("broken pipe") || msg.contains("communications link")
                        || msg.contains("socket") || msg.contains("deadlock") || msg.contains("hikari")
                        || msg.contains("temporary failure") || msg.contains("unreachable")) {
                    return true;
                }
            }
            t = t.getCause();
        }
        return false;
    }

    public int pendingCount() {
        return bufferSize.get();
    }
}

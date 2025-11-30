package com.example.exam.service;

import com.example.exam.config.RabbitMQConfig;
import com.example.exam.dto.SnapshotMessage;
import com.example.exam.model.Incident;
import com.example.exam.model.IncidentStatus;
import com.example.exam.model.IncidentType;
import com.example.exam.model.MediaSnapshot;
import com.example.exam.repository.IncidentRepository;
import com.example.exam.repository.MediaSnapshotRepository;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;

/**
 * Worker that processes snapshot messages from RabbitMQ
 * Performs face detection (stubbed) and creates incidents
 * 
 * Flow:
 * 1. Receive message from queue
 * 2. Load snapshot from DB
 * 3. Perform face detection (stubbed as random)
 * 4. Update face_count in DB
 * 5. Create incident if no face or multiple faces
 */
@Service
public class FaceDetectionWorker {
    
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(FaceDetectionWorker.class);
    private static final Random random = new Random();
    
    private final MediaSnapshotRepository snapshotRepository;
    private final IncidentRepository incidentRepository;
    
    public FaceDetectionWorker(MediaSnapshotRepository snapshotRepository,
                               IncidentRepository incidentRepository) {
        this.snapshotRepository = snapshotRepository;
        this.incidentRepository = incidentRepository;
    }
    
    /**
     * Listen to snapshot.process queue
     * Process each snapshot message asynchronously
     */
    @RabbitListener(queues = RabbitMQConfig.QUEUE_NAME)
    @Transactional
    public void processSnapshot(SnapshotMessage message) {
        log.info("Processing snapshot: snapshotId={}, sessionId={}", 
                message.snapshotId(), message.sessionId());
        
        try {
            // 1. Load snapshot from DB
            Optional<MediaSnapshot> snapshotOpt = snapshotRepository.findById(message.snapshotId());
            if (snapshotOpt.isEmpty()) {
                log.warn("Snapshot not found: {}", message.snapshotId());
                return;
            }
            
            MediaSnapshot snapshot = snapshotOpt.get();
            
            // 2. Perform face detection (STUB - random for now)
            int faceCount = detectFaces(snapshot.getObjectKey());
            
            // 3. Update face_count in DB
            snapshot.setFaceCount(faceCount);
            snapshotRepository.save(snapshot);
            
            log.info("Face detection complete: snapshotId={}, faceCount={}", 
                    snapshot.getId(), faceCount);
            
            // 4. Create incident if needed
            createIncidentIfNeeded(snapshot);
            
        } catch (Exception ex) {
            log.error("Error processing snapshot: snapshotId={}, error={}", 
                    message.snapshotId(), ex.getMessage(), ex);
            // Don't throw - let message be acknowledged
            // In production, might want to use DLQ for failed messages
        }
    }
    
    /**
     * Stub face detection - returns random face count
     * Distribution:
     * - 0 faces: 30% (candidate not looking at camera)
     * - 1 face: 60% (normal)
     * - 2 faces: 10% (someone helping)
     * 
     * In real implementation, would use OpenCV or ML model
     */
    private int detectFaces(String objectKey) {
        int rand = random.nextInt(100);
        if (rand < 30) {
            return 0; // No face
        } else if (rand < 90) {
            return 1; // Normal
        } else {
            return 2; // Multiple faces
        }
    }
    
    /**
     * Create incident based on face count
     * - 0 faces → NO_FACE incident
     * - 2+ faces → MULTI_FACE incident
     * 
     * Idempotent: Check if incident already exists
     */
    private void createIncidentIfNeeded(MediaSnapshot snapshot) {
        UUID sessionId = snapshot.getSessionId();
        Long timestamp = snapshot.getTs();
        int faceCount = snapshot.getFaceCount();
        
        IncidentType type = null;
        String reason = null;
        BigDecimal score = null;
        
        if (faceCount == 0) {
            type = IncidentType.NO_FACE;
            reason = "No face detected in webcam snapshot";
            score = new BigDecimal("0.70");
        } else if (faceCount >= 2) {
            type = IncidentType.MULTI_FACE;
            reason = String.format("%d faces detected (possible assistance)", faceCount);
            score = new BigDecimal("0.85");
        } else {
            // Normal case (1 face) - no incident
            return;
        }
        
        // Check if incident already exists (idempotency)
        Optional<Incident> existing = incidentRepository.findBySessionIdAndTypeAndTs(
                sessionId, type, timestamp
        );
        
        if (existing.isPresent()) {
            log.debug("Incident already exists: sessionId={}, type={}, ts={}", 
                    sessionId, type, timestamp);
            return;
        }
        
        // Create new incident
        Incident incident = new Incident();
        incident.setSessionId(sessionId);
        incident.setType(type);
        incident.setTs(timestamp);
        incident.setScore(score);
        incident.setReason(reason);
        incident.setEvidenceUrl(snapshot.getObjectKey()); // Link to snapshot
        incident.setStatus(IncidentStatus.OPEN);
        incident.setCreatedAt(Instant.now());
        
        incidentRepository.save(incident);
        
        log.warn("Created incident: sessionId={}, type={}, faceCount={}, score={}", 
                sessionId, type, faceCount, score);
    }
}

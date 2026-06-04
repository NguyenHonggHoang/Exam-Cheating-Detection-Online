package com.example.exam.service;

import com.example.exam.config.RabbitMQConfig;
import com.example.exam.entity.FaceEmbedding;
import com.example.exam.entity.IdentityVerification;
import com.example.exam.entity.StudentIdentityPhoto;
import com.example.exam.repository.FaceEmbeddingRepository;
import com.example.exam.repository.IdentityVerificationRepository;
import com.example.exam.repository.StudentIdentityPhotoRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Identity Verification Service
 * 
 * Handles:
 * - Student ID photo upload and management
 * - Face verification requests (via RabbitMQ)
 * - Verification result processing
 */
@Service
public class IdentityVerificationService {
    
    private static final Logger log = LoggerFactory.getLogger(IdentityVerificationService.class);
    
    private final StudentIdentityPhotoRepository photoRepository;
    private final FaceEmbeddingRepository embeddingRepository;
    private final IdentityVerificationRepository verificationRepository;
    private final RabbitTemplate rabbitTemplate;
    private final StorageService storageService;
    private final ObjectMapper objectMapper;
    
    @Value("${minio.public-url:http://localhost:9002}")
    private String minioPublicUrl;
    
    @Value("${minio.bucket.evidence:exam-evidence}")
    private String evidenceBucket;
    
    @Value("${minio.bucket.identity:exam-identity}")
    private String identityBucket;
    
    public IdentityVerificationService(
            StudentIdentityPhotoRepository photoRepository,
            FaceEmbeddingRepository embeddingRepository,
            IdentityVerificationRepository verificationRepository,
            RabbitTemplate rabbitTemplate,
            StorageService storageService,
            ObjectMapper objectMapper) {
        this.photoRepository = photoRepository;
        this.embeddingRepository = embeddingRepository;
        this.verificationRepository = verificationRepository;
        this.rabbitTemplate = rabbitTemplate;
        this.storageService = storageService;
        this.objectMapper = objectMapper;
    }
    
    @Transactional
    public StudentIdentityPhoto uploadIdPhoto(
            String userId,
            String objectKey,
            String originalFilename,
            Long fileSize,
            String mimeType) {
        
        log.info("Uploading ID photo for user: {}", userId);
        
        Optional<StudentIdentityPhoto> existing = photoRepository.findByUserId(userId);
        
        StudentIdentityPhoto photo;
        if (existing.isPresent()) {
            photo = existing.get();
            photo.setObjectKey(objectKey);
            photo.setOriginalFilename(originalFilename);
            photo.setFileSize(fileSize);
            photo.setMimeType(mimeType);
            photo.setStatus(StudentIdentityPhoto.Status.PENDING);
            photo.setVerifiedAt(null);
            photo.setVerifiedBy(null);
            photo.setRejectionReason(null);
        } else {
            photo = new StudentIdentityPhoto();
            photo.setUserId(userId);
            photo.setObjectKey(objectKey);
            photo.setOriginalFilename(originalFilename);
            photo.setFileSize(fileSize);
            photo.setMimeType(mimeType);
        }
        
        photo = photoRepository.save(photo);
        
        requestEmbeddingExtraction(userId, getPhotoUrl(objectKey), photo.getId());
        
        log.info("ID photo uploaded: {}", photo.getId());
        return photo;
    }
    
    public Optional<StudentIdentityPhoto> getIdPhoto(String userId) {
        return photoRepository.findByUserId(userId);
    }
    
    public boolean hasIdPhoto(String userId) {
        return photoRepository.existsByUserId(userId);
    }
    
    public Optional<StudentIdentityPhoto> getIdPhotoById(UUID photoId) {
        return photoRepository.findById(photoId);
    }
    
    @Transactional
    public StudentIdentityPhoto verifyIdPhoto(UUID photoId, String adminId, boolean approved, String reason) {
        StudentIdentityPhoto photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new IllegalArgumentException("Photo not found: " + photoId));
        
        if (approved) {
            photo.setStatus(StudentIdentityPhoto.Status.VERIFIED);
            photo.setVerifiedAt(Instant.now());
            photo.setVerifiedBy(adminId);
            photo.setRejectionReason(null);
        } else {
            photo.setStatus(StudentIdentityPhoto.Status.REJECTED);
            photo.setVerifiedAt(Instant.now());
            photo.setVerifiedBy(adminId);
            photo.setRejectionReason(reason);
        }
        
        return photoRepository.save(photo);
    }
    
    public String requestVerification(UUID sessionId, String userId, String probeObjectKey) {
        log.info("Requesting identity verification: session={}, user={}", sessionId, userId);
        
        StudentIdentityPhoto idPhoto = photoRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("Student ID photo not found for user: " + userId));
        
        if (idPhoto.getStatus() == StudentIdentityPhoto.Status.REJECTED) {
            throw new IllegalStateException("Student ID photo was rejected. Please upload a new one.");
        }
        
        String requestId = UUID.randomUUID().toString();
        String referenceUrl = getPhotoUrl(idPhoto.getObjectKey());
        String probeUrl = getPhotoUrl(probeObjectKey);
        
        Map<String, Object> message = Map.of(
                "requestId", requestId,
                "sessionId", sessionId.toString(),
                "userId", userId,
                "referenceUrl", referenceUrl,
                "probeUrl", probeUrl,
                "probeObjectKey", probeObjectKey
        );
        
        try {
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.EXCHANGE_NAME,
                    RabbitMQConfig.FACE_VERIFICATION_ROUTING_KEY,
                    message);
            log.info("Verification request sent: {}", requestId);
        } catch (Exception e) {
            log.error("Failed to send verification request", e);
            throw new RuntimeException("Failed to queue verification request", e);
        }
        
        return requestId;
    }
    
    @Transactional
    public IdentityVerification verifySync(UUID sessionId, String userId, String probeObjectKey) {
        log.info("Synchronous identity verification: session={}, user={}", sessionId, userId);
        
        StudentIdentityPhoto idPhoto = photoRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("Student ID photo not found for user: " + userId));
        
        String referenceUrl = getPhotoUrl(idPhoto.getObjectKey());
        String probeUrl = getPhotoUrl(probeObjectKey);
        
        IdentityVerification verification = new IdentityVerification();
        verification.setSessionId(sessionId);
        verification.setUserId(userId);
        verification.setReferenceUrl(referenceUrl);
        verification.setProbeUrl(probeUrl);
        verification.setProbeObjectKey(probeObjectKey);
        
        verification.setVerified(false);
        verification.setConfidence(0.0);
        verification.setSimilarity(0.0);
        verification.setThreshold(0.4);
        verification.setMessage("Verification pending...");
        verification.setReferenceFaceDetected(true);
        verification.setProbeFaceDetected(true);
        
        return verificationRepository.save(verification);
    }
    
    @RabbitListener(queues = RabbitMQConfig.FACE_VERIFICATION_RESULT_QUEUE)
    @Transactional
    public void handleVerificationResult(Map<String, Object> result) {
        log.info("Received verification result: {}", result);
        
        try {
            String sessionIdStr = (String) result.get("sessionId");
            String userId = (String) result.get("userId");
            
            if (sessionIdStr == null || userId == null) {
                log.warn("Invalid verification result: missing sessionId or userId");
                return;
            }
            
            UUID sessionId = UUID.fromString(sessionIdStr);
            
            IdentityVerification verification = new IdentityVerification();
            verification.setSessionId(sessionId);
            verification.setUserId(userId);
            verification.setVerified((Boolean) result.getOrDefault("verified", false));
            verification.setConfidence(((Number) result.getOrDefault("confidence", 0.0)).doubleValue());
            verification.setSimilarity(((Number) result.getOrDefault("similarity", 0.0)).doubleValue());
            verification.setThreshold(((Number) result.getOrDefault("threshold", 0.4)).doubleValue());
            verification.setMessage((String) result.get("message"));
            verification.setReferenceFaceDetected((Boolean) result.getOrDefault("referenceFaceDetected", false));
            verification.setProbeFaceDetected((Boolean) result.getOrDefault("probeFaceDetected", false));
            verification.setProcessingTimeMs(((Number) result.getOrDefault("processingTimeMs", 0)).intValue());
            verification.setModelUsed((String) result.get("modelUsed"));
            
            verificationRepository.save(verification);
            
            log.info("Verification result saved: session={}, verified={}, confidence={}",
                    sessionId, verification.getVerified(), verification.getConfidence());
            
        } catch (Exception e) {
            log.error("Failed to process verification result", e);
        }
    }
    
    public java.util.List<IdentityVerification> getSessionVerifications(UUID sessionId) {
        return verificationRepository.findBySessionId(sessionId);
    }
    
    public Optional<IdentityVerification> getLatestVerification(UUID sessionId) {
        return verificationRepository.findTopBySessionIdOrderByVerifiedAtDesc(sessionId);
    }
    
    private String getPhotoUrl(String objectKey) {
        String bucket = determineBucket(objectKey);
        return minioPublicUrl + "/" + bucket + "/" + objectKey;
    }
    
    private String determineBucket(String objectKey) {
        if (objectKey == null) return evidenceBucket;
        
        if (objectKey.contains("/id-photo") || 
            objectKey.contains("/id-card") ||
            objectKey.contains("/live-photo")) {
            return identityBucket;
        }
        
        return evidenceBucket;
    }
    
    private void requestEmbeddingExtraction(String userId, String photoUrl, UUID sourceId) {
        Map<String, Object> message = Map.of(
                "userId", userId,
                "photoUrl", photoUrl,
                "sourceId", sourceId.toString(),
                "sourceType", "ID_PHOTO"
        );
        
        try {
            rabbitTemplate.convertAndSend("face.embedding.extract", objectMapper.writeValueAsString(message));
        } catch (Exception e) {
            log.warn("Failed to queue embedding extraction: {}", e.getMessage());
        }
    }
}

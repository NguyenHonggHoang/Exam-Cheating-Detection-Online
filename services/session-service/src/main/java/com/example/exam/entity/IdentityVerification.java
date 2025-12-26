package com.example.exam.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * Identity Verification - Comparison results between ID photo and exam snapshot
 */
@Entity
@Table(name = "identity_verifications")
public class IdentityVerification {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @Column(name = "session_id", nullable = false)
    private UUID sessionId;
    
    @Column(name = "user_id", nullable = false)
    private String userId;
    
    @Column(name = "reference_embedding_id")
    private UUID referenceEmbeddingId;
    
    @Column(name = "probe_embedding_id")
    private UUID probeEmbeddingId;
    
    @Column(nullable = false)
    private Boolean verified;
    
    @Column(nullable = false)
    private Double confidence;
    
    @Column(nullable = false)
    private Double similarity;
    
    @Column(nullable = false)
    private Double threshold;
    
    @Column(name = "reference_face_detected", nullable = false)
    private Boolean referenceFaceDetected = true;
    
    @Column(name = "probe_face_detected", nullable = false)
    private Boolean probeFaceDetected = true;
    
    @Column(name = "reference_url")
    private String referenceUrl;
    
    @Column(name = "probe_url")
    private String probeUrl;
    
    @Column(name = "probe_object_key")
    private String probeObjectKey;
    
    @Column(name = "message")
    private String message;
    
    @Column(name = "processing_time_ms")
    private Integer processingTimeMs;
    
    @Column(name = "model_used")
    private String modelUsed;
    
    @Column(name = "verified_at", nullable = false)
    private Instant verifiedAt = Instant.now();
    
    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    
    public UUID getSessionId() { return sessionId; }
    public void setSessionId(UUID sessionId) { this.sessionId = sessionId; }
    
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public UUID getReferenceEmbeddingId() { return referenceEmbeddingId; }
    public void setReferenceEmbeddingId(UUID referenceEmbeddingId) { this.referenceEmbeddingId = referenceEmbeddingId; }
    
    public UUID getProbeEmbeddingId() { return probeEmbeddingId; }
    public void setProbeEmbeddingId(UUID probeEmbeddingId) { this.probeEmbeddingId = probeEmbeddingId; }
    
    public Boolean getVerified() { return verified; }
    public void setVerified(Boolean verified) { this.verified = verified; }
    
    public Double getConfidence() { return confidence; }
    public void setConfidence(Double confidence) { this.confidence = confidence; }
    
    public Double getSimilarity() { return similarity; }
    public void setSimilarity(Double similarity) { this.similarity = similarity; }
    
    public Double getThreshold() { return threshold; }
    public void setThreshold(Double threshold) { this.threshold = threshold; }
    
    public Boolean getReferenceFaceDetected() { return referenceFaceDetected; }
    public void setReferenceFaceDetected(Boolean referenceFaceDetected) { this.referenceFaceDetected = referenceFaceDetected; }
    
    public Boolean getProbeFaceDetected() { return probeFaceDetected; }
    public void setProbeFaceDetected(Boolean probeFaceDetected) { this.probeFaceDetected = probeFaceDetected; }
    
    public String getReferenceUrl() { return referenceUrl; }
    public void setReferenceUrl(String referenceUrl) { this.referenceUrl = referenceUrl; }
    
    public String getProbeUrl() { return probeUrl; }
    public void setProbeUrl(String probeUrl) { this.probeUrl = probeUrl; }
    
    public String getProbeObjectKey() { return probeObjectKey; }
    public void setProbeObjectKey(String probeObjectKey) { this.probeObjectKey = probeObjectKey; }
    
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    
    public Integer getProcessingTimeMs() { return processingTimeMs; }
    public void setProcessingTimeMs(Integer processingTimeMs) { this.processingTimeMs = processingTimeMs; }
    
    public String getModelUsed() { return modelUsed; }
    public void setModelUsed(String modelUsed) { this.modelUsed = modelUsed; }
    
    public Instant getVerifiedAt() { return verifiedAt; }
    public void setVerifiedAt(Instant verifiedAt) { this.verifiedAt = verifiedAt; }
}

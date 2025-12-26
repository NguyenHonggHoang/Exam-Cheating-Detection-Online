package com.example.exam.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * Face Embedding - Stored face embeddings for comparison
 */
@Entity
@Table(name = "face_embeddings")
public class FaceEmbedding {
    
    public enum SourceType {
        ID_PHOTO,       // From student ID card photo
        EXAM_SNAPSHOT   // From exam session snapshot
    }
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @Column(name = "user_id", nullable = false)
    private String userId;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false)
    private SourceType sourceType;
    
    @Column(name = "source_id")
    private UUID sourceId;
    
    @Column(name = "embedding_model", nullable = false)
    private String embeddingModel;
    
    @Column(name = "embedding_dimension", nullable = false)
    private Integer embeddingDimension;
    
    @Column(name = "embedding", nullable = false, columnDefinition = "BYTEA")
    private byte[] embedding;
    
    @Column(name = "embedding_json", columnDefinition = "JSONB")
    private String embeddingJson;
    
    @Column(name = "face_detected", nullable = false)
    private Boolean faceDetected = true;
    
    @Column(name = "face_count")
    private Integer faceCount = 1;
    
    @Column(name = "confidence")
    private Double confidence;
    
    @Column(name = "extracted_at", nullable = false)
    private Instant extractedAt = Instant.now();
    
    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public SourceType getSourceType() { return sourceType; }
    public void setSourceType(SourceType sourceType) { this.sourceType = sourceType; }
    
    public UUID getSourceId() { return sourceId; }
    public void setSourceId(UUID sourceId) { this.sourceId = sourceId; }
    
    public String getEmbeddingModel() { return embeddingModel; }
    public void setEmbeddingModel(String embeddingModel) { this.embeddingModel = embeddingModel; }
    
    public Integer getEmbeddingDimension() { return embeddingDimension; }
    public void setEmbeddingDimension(Integer embeddingDimension) { this.embeddingDimension = embeddingDimension; }
    
    public byte[] getEmbedding() { return embedding; }
    public void setEmbedding(byte[] embedding) { this.embedding = embedding; }
    
    public String getEmbeddingJson() { return embeddingJson; }
    public void setEmbeddingJson(String embeddingJson) { this.embeddingJson = embeddingJson; }
    
    public Boolean getFaceDetected() { return faceDetected; }
    public void setFaceDetected(Boolean faceDetected) { this.faceDetected = faceDetected; }
    
    public Integer getFaceCount() { return faceCount; }
    public void setFaceCount(Integer faceCount) { this.faceCount = faceCount; }
    
    public Double getConfidence() { return confidence; }
    public void setConfidence(Double confidence) { this.confidence = confidence; }
    
    public Instant getExtractedAt() { return extractedAt; }
    public void setExtractedAt(Instant extractedAt) { this.extractedAt = extractedAt; }
}

package com.example.exam.repository;

import com.example.exam.entity.FaceEmbedding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FaceEmbeddingRepository extends JpaRepository<FaceEmbedding, UUID> {
    
    List<FaceEmbedding> findByUserId(String userId);
    
    Optional<FaceEmbedding> findByUserIdAndSourceType(String userId, FaceEmbedding.SourceType sourceType);
    
    Optional<FaceEmbedding> findTopByUserIdAndSourceTypeOrderByExtractedAtDesc(
            String userId, FaceEmbedding.SourceType sourceType);
    
    boolean existsByUserIdAndSourceType(String userId, FaceEmbedding.SourceType sourceType);
}

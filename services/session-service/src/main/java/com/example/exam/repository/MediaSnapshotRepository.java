package com.example.exam.repository;

import com.example.exam.model.MediaSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MediaSnapshotRepository extends JpaRepository<MediaSnapshot, UUID> {
    Optional<MediaSnapshot> findByIdempotencyKey(String idempotencyKey);
    List<MediaSnapshot> findBySessionIdOrderByTsAsc(UUID sessionId);
    
    /**
     * Count snapshots for a session
     * Used by StorageUsageService for quota tracking
     */
    Integer countBySessionId(UUID sessionId);
    
    /**
     * Calculate total file size for a session
     * Used by StorageUsageService for quota tracking
     * 
     * Note: Assumes MediaSnapshot has 'fileSize' field
     * If field name is different, update query accordingly
     */
    @Query("SELECT COALESCE(SUM(m.fileSize), 0) FROM MediaSnapshot m WHERE m.sessionId = ?1")
    Long calculateTotalSize(UUID sessionId);
}

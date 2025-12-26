package com.example.exam.repository;

import com.example.exam.entity.VerificationEscalation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VerificationEscalationRepository extends JpaRepository<VerificationEscalation, UUID> {
    
    Optional<VerificationEscalation> findBySessionIdAndUserId(UUID sessionId, String userId);
    
    Optional<VerificationEscalation> findFirstBySessionIdOrderByCreatedAtDesc(UUID sessionId);
    
    List<VerificationEscalation> findByStatus(VerificationEscalation.Status status);
    
    @Query("SELECT v FROM VerificationEscalation v WHERE v.status = 'PENDING' ORDER BY v.createdAt ASC")
    List<VerificationEscalation> findPendingEscalations();
    
    List<VerificationEscalation> findBySessionId(UUID sessionId);
}

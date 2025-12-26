package com.example.exam.repository;

import com.example.exam.entity.IdentityVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface IdentityVerificationRepository extends JpaRepository<IdentityVerification, UUID> {
    
    List<IdentityVerification> findBySessionId(UUID sessionId);
    
    List<IdentityVerification> findByUserId(String userId);
    
    Optional<IdentityVerification> findTopBySessionIdOrderByVerifiedAtDesc(UUID sessionId);
    
    long countBySessionIdAndVerified(UUID sessionId, Boolean verified);
}

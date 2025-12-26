package com.example.exam.repository;

import com.example.exam.entity.StudentProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudentProfileRepository extends JpaRepository<StudentProfile, UUID> {
    
    Optional<StudentProfile> findByUserId(String userId);
    
    boolean existsByUserId(String userId);
}

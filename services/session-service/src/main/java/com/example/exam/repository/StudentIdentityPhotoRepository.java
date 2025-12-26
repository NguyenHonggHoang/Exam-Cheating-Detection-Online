package com.example.exam.repository;

import com.example.exam.entity.StudentIdentityPhoto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudentIdentityPhotoRepository extends JpaRepository<StudentIdentityPhoto, UUID> {
    
    Optional<StudentIdentityPhoto> findByUserId(String userId);
    
    boolean existsByUserId(String userId);
}

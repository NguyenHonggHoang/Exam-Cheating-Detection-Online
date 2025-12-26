package com.example.exam.repository;

import com.example.exam.model.StudentShadowEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for Student Shadow (cached user data)
 */
@Repository
public interface StudentShadowRepository extends JpaRepository<StudentShadowEntity, String> {

    Optional<StudentShadowEntity> findByStudentCode(String studentCode);
}

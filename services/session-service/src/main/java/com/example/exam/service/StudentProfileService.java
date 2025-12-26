package com.example.exam.service;

import com.example.exam.entity.StudentProfile;
import com.example.exam.repository.StudentProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Student Profile Service
 * 
 * Manages student profile data (faculty, class, batch year).
 * 
 * @deprecated As of 2025-12-26, student profile management has minimal usage.
 * Tied to deprecated StudentProfileController.
 * This will be removed in a future version.
 */
@Deprecated
@Service
public class StudentProfileService {
    
    private static final Logger log = LoggerFactory.getLogger(StudentProfileService.class);
    
    private final StudentProfileRepository profileRepository;
    
    public StudentProfileService(StudentProfileRepository profileRepository) {
        this.profileRepository = profileRepository;
    }
    
    /**
     * Get student profile by user ID
     */
    public Optional<StudentProfile> getProfile(String userId) {
        return profileRepository.findByUserId(userId);
    }
    
    /**
     * Check if profile exists and is completed
     */
    public boolean isProfileCompleted(String userId) {
        return profileRepository.findByUserId(userId)
                .map(StudentProfile::getProfileCompleted)
                .orElse(false);
    }
    
    /**
     * Create or update student profile
     */
    @Transactional
    public StudentProfile updateProfile(String userId, UpdateProfileRequest request) {
        StudentProfile profile = profileRepository.findByUserId(userId)
                .orElseGet(() -> {
                    StudentProfile newProfile = new StudentProfile();
                    newProfile.setUserId(userId);
                    return newProfile;
                });
        
        if (request.fullName() != null) {
            profile.setFullName(request.fullName());
        }
        if (request.studentId() != null) {
            profile.setStudentId(request.studentId());
        }
        if (request.faculty() != null) {
            profile.setFaculty(request.faculty());
        }
        if (request.className() != null) {
            profile.setClassName(request.className());
        }
        if (request.batchYear() != null) {
            profile.setBatchYear(request.batchYear());
        }
        if (request.department() != null) {
            profile.setDepartment(request.department());
        }
        
        // Check if profile is complete
        boolean isComplete = profile.getFaculty() != null && !profile.getFaculty().isEmpty()
                && profile.getClassName() != null && !profile.getClassName().isEmpty()
                && profile.getBatchYear() != null;
        profile.setProfileCompleted(isComplete);
        
        StudentProfile saved = profileRepository.save(profile);
        log.info("[StudentProfile] Updated profile for user {}: completed={}", userId, isComplete);
        
        return saved;
    }
    
    /**
     * DTO for profile update request
     */
    public record UpdateProfileRequest(
            String fullName,
            String studentId,
            String faculty,
            String className,
            Integer batchYear,
            String department
    ) {}
    
    /**
     * DTO for profile response
     */
    public record ProfileResponse(
            String userId,
            String fullName,
            String studentId,
            String faculty,
            String className,
            Integer batchYear,
            String department,
            Boolean profileCompleted
    ) {
        public static ProfileResponse from(StudentProfile profile) {
            return new ProfileResponse(
                    profile.getUserId(),
                    profile.getFullName(),
                    profile.getStudentId(),
                    profile.getFaculty(),
                    profile.getClassName(),
                    profile.getBatchYear(),
                    profile.getDepartment(),
                    profile.getProfileCompleted()
            );
        }
    }
}

package com.examplatform.identity.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {

    Optional<UserEntity> findByUsernameIgnoreCase(String username);

    boolean existsByUsernameIgnoreCase(String username);
    
    /**
     * Search users by username or email (partial match)
     */
    List<UserEntity> findByUsernameContainingIgnoreCaseOrEmailContainingIgnoreCase(
        String username, String email
    );
    
    /**
     * Find users by role with pagination
     */
    Page<UserEntity> findByRolesRoleName(RoleName roleName, Pageable pageable);
    
    /**
     * Find active users by role
     */
    List<UserEntity> findByEnabledTrueAndRolesRoleName(RoleName roleName);
    
    /**
     * Check if email exists
     */
    boolean existsByEmailIgnoreCase(String email);
    
    /**
     * Find by email
     */
    Optional<UserEntity> findByEmailIgnoreCase(String email);
}



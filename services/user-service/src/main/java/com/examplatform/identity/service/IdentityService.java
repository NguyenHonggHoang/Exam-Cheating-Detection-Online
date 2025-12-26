package com.examplatform.identity.service;

import com.examplatform.identity.domain.RoleEntity;
import com.examplatform.identity.domain.RoleName;
import com.examplatform.identity.domain.RoleRepository;
import com.examplatform.identity.domain.UserEntity;
import com.examplatform.identity.domain.UserRepository;
import com.examplatform.identity.web.dto.CreateUserRequest;
import com.examplatform.identity.web.dto.RegisterRequest;
import com.examplatform.identity.web.dto.UserResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class IdentityService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public IdentityService(UserRepository userRepository,
                           RoleRepository roleRepository,
                           PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public UserResponse registerCandidate(RegisterRequest request) {
        ensureUsernameAvailable(request.username());
        RoleEntity candidateRole = findRole(RoleName.CANDIDATE);
        UserEntity user = new UserEntity(
                request.username().toLowerCase(),
                passwordEncoder.encode(request.password()),
                request.email().toLowerCase());
        user.assignRole(candidateRole);
        UserEntity saved = userRepository.save(user);
        return toResponse(saved);
    }

    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        ensureUsernameAvailable(request.username());
        RoleEntity targetRole = findRole(request.role());
        UserEntity user = new UserEntity(
                request.username().toLowerCase(),
                passwordEncoder.encode(request.password()),
                request.email().toLowerCase());
        user.assignRole(targetRole);
        UserEntity saved = userRepository.save(user);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public UserResponse findByUsername(String username) {
        UserEntity user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));
        return toResponse(user);
    }

    @Transactional(readOnly = true)
    public UserResponse findById(UUID id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
        return toResponse(user);
    }

    @Transactional
    public UserResponse updateUser(UUID id, com.examplatform.identity.web.dto.UpdateUserRequest request) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));

        if (request.enabled() != null) {
            if (request.enabled()) {
                user.enable();
            } else {
                user.disable();
            }
        }
        
        if (request.role() != null) {
            // Remove all existing roles and set new one for simplicity in this model
            // Or add to existing? The UI implies single role selection usually for main role
            // Let's clear and set to ensure strict role change if that's the intent
            user.getRoles().clear();
            user.assignRole(findRole(request.role()));
        }

        UserEntity saved = userRepository.save(user);
        return toResponse(saved);
    }
    
    @Transactional
    public void deleteUser(UUID id) {
        if (!userRepository.existsById(id)) {
            throw new IllegalArgumentException("User not found: " + id);
        }
        userRepository.deleteById(id);
    }
    
    @Transactional
    public void resetPassword(UUID id, String newPassword) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }
    
    @Transactional
    public UserResponse assignRole(UUID id, RoleName roleName) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
        
        // Check if already has role
        boolean hasRole = user.getRoles().stream()
                .anyMatch(r -> r.getRoleName() == roleName);
                
        if (!hasRole) {
            user.assignRole(findRole(roleName));
            user = userRepository.save(user);
        }
        return toResponse(user);
    }

    @Transactional(readOnly = true)
    public java.util.List<UserResponse> findAll(RoleName role) {
        java.util.List<UserEntity> users;
        if (role != null) {
            // Use unpaged pagination to get all results for the role
            users = userRepository.findByRolesRoleName(role, org.springframework.data.domain.Pageable.unpaged()).getContent();
        } else {
            users = userRepository.findAll();
        }
        return users.stream().map(this::toResponse).collect(Collectors.toList());
    }

    private void ensureUsernameAvailable(String username) {
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new IllegalArgumentException("Username already taken");
        }
    }

    private RoleEntity findRole(RoleName roleName) {
        return roleRepository.findByRoleName(roleName)
                .orElseThrow(() -> new IllegalStateException("Missing role: " + roleName));
    }

    private UserResponse toResponse(UserEntity entity) {
        Set<String> authorities = entity.getRoles()
                .stream()
                .map(role -> "ROLE_" + role.getRoleName().name())
                .collect(Collectors.toSet());

        UUID id = entity.getId();
        return new UserResponse(
                id != null ? id.toString() : null,
                entity.getUsername(),
                entity.getEmail(),
                entity.isEnabled(),
                authorities
        );
    }
}



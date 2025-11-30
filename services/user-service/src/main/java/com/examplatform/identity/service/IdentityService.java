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


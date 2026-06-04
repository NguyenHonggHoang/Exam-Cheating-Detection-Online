package com.examplatform.admin.service;

import com.examplatform.admin.web.dto.CreateUserRequest;
import com.examplatform.admin.web.dto.UserResponse; 
import com.examplatform.user.grpc.*;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Set;

@Service
public class UserManagementService {

    @GrpcClient("user-service")
    private UserGrpcServiceGrpc.UserGrpcServiceBlockingStub userGrpcServiceStub;

    public UserResponse createUser(CreateUserRequest request, Jwt jwt) {
        try {
            CreateUserGrpcRequest grpcRequest = CreateUserGrpcRequest.newBuilder()
                    .setUsername(request.username())
                    .setEmail(request.email())
                    .setFullName("") 
                    .setRole(request.role())
                    .build();

            UserGrpcResponse grpcResponse = userGrpcServiceStub.createUser(grpcRequest);
            
            Set<String> authorities = new HashSet<>();
            authorities.add("ROLE_" + request.role());

            return new UserResponse(
                    grpcResponse.getId(),
                    grpcResponse.getUsername(),
                    grpcResponse.getEmail(),
                    true,
                    authorities
            );
        } catch (Exception e) {
            System.err.println("Error creating user via gRPC: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Error creating user via gRPC: " + e.getMessage(), e);
        }
    }

    public Object listUsers(int page, int size, String role, Jwt jwt) {
        try {
            ListUsersGrpcRequest grpcRequest = ListUsersGrpcRequest.newBuilder()
                    .setPage(page)
                    .setSize(size)
                    .setRole(role != null ? role : "")
                    .build();

            ListUsersGrpcResponse grpcResponse = userGrpcServiceStub.listUsers(grpcRequest);
            
            java.util.Map<String, Object> result = new java.util.HashMap<>();
            java.util.List<java.util.Map<String, Object>> usersList = new java.util.ArrayList<>();
            
            for (UserGrpcResponse u : grpcResponse.getUsersList()) {
                java.util.Map<String, Object> userMap = new java.util.HashMap<>();
                userMap.put("id", u.getId());
                userMap.put("username", u.getUsername());
                userMap.put("email", u.getEmail());
                userMap.put("enabled", true);
                userMap.put("authorities", java.util.List.of("ROLE_" + u.getRole().toUpperCase()));
                usersList.add(userMap);
            }
            
            result.put("content", usersList);
            result.put("totalPages", grpcResponse.getTotalPages());
            result.put("totalElements", grpcResponse.getTotalElements());
            
            return result;
        } catch (Exception e) {
            System.err.println("Error listing users via gRPC: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Error listing users via gRPC: " + e.getMessage(), e);
        }
    }
}
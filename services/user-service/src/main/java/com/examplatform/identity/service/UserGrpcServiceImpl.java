package com.examplatform.identity.service;

import com.examplatform.identity.domain.RoleName;
import com.examplatform.identity.web.dto.CreateUserRequest;
import com.examplatform.identity.web.dto.UserResponse;
import com.examplatform.user.grpc.*;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;

@GrpcService
public class UserGrpcServiceImpl extends UserGrpcServiceGrpc.UserGrpcServiceImplBase {

    private final IdentityService identityService;

    public UserGrpcServiceImpl(IdentityService identityService) {
        this.identityService = identityService;
    }

    @Override
    @PreAuthorize("hasAuthority('SCOPE_user.write') and hasAuthority('user:create')")
    public void createUser(CreateUserGrpcRequest request, StreamObserver<UserGrpcResponse> responseObserver) {
        try {
            String password = "temp-password-123"; 
            CreateUserRequest dtoRequest = new CreateUserRequest(
                    request.getUsername(),
                    password,
                    request.getEmail(),
                    RoleName.valueOf(request.getRole().toUpperCase())
            );

            UserResponse userResponse = identityService.createUser(dtoRequest);
            
            UserGrpcResponse response = UserGrpcResponse.newBuilder()
                    .setId(userResponse.id() != null ? userResponse.id() : "")
                    .setUsername(userResponse.username())
                    .setEmail(userResponse.email())
                    .setRole(request.getRole())
                    .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            responseObserver.onError(io.grpc.Status.INTERNAL
                    .withDescription("Error creating user: " + e.getMessage())
                    .asRuntimeException());
        }
    }

    @Override
    @PreAuthorize("hasAuthority('SCOPE_user.read')")
    public void listUsers(ListUsersGrpcRequest request, StreamObserver<ListUsersGrpcResponse> responseObserver) {
        try {
            RoleName role = null;
            if (request.getRole() != null && !request.getRole().isBlank()) {
                role = RoleName.valueOf(request.getRole().toUpperCase());
            }

            List<UserResponse> users = identityService.findAll(role);
            
            ListUsersGrpcResponse.Builder builder = ListUsersGrpcResponse.newBuilder();
            for (UserResponse u : users) {
                String mainRole = request.getRole();
                if ((mainRole == null || mainRole.isBlank()) && u.authorities() != null && !u.authorities().isEmpty()) {
                    mainRole = u.authorities().iterator().next().replace("ROLE_", "");
                }
                
                builder.addUsers(UserGrpcResponse.newBuilder()
                        .setId(u.id() != null ? u.id() : "")
                        .setUsername(u.username())
                        .setEmail(u.email())
                        .setRole(mainRole != null ? mainRole : "")
                        .build());
            }
            
            builder.setTotalPages(1);
            builder.setTotalElements(users.size());

            responseObserver.onNext(builder.build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            responseObserver.onError(io.grpc.Status.INTERNAL
                    .withDescription("Error listing users: " + e.getMessage())
                    .asRuntimeException());
        }
    }
}

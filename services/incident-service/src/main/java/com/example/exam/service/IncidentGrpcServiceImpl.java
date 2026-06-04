package com.example.exam.service;

import com.example.exam.dto.ClientEventRequest;
import com.examplatform.incident.grpc.*;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.devh.boot.grpc.server.service.GrpcService;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.UUID;

@GrpcService
@RequiredArgsConstructor
@Slf4j
public class IncidentGrpcServiceImpl extends IncidentGrpcServiceGrpc.IncidentGrpcServiceImplBase {

    private final ClientEventService clientEventService;

    @Override
    @PreAuthorize("hasAuthority('SCOPE_incident.write') and hasAuthority('incident:create')")
    public void sendClientEvent(ClientEventGrpcRequest request, StreamObserver<ClientEventGrpcResponse> responseObserver) {
        log.info("Received gRPC client event: sessionId={}, type={}, violation={}", 
                request.getSessionId(), request.getEventType(), request.getViolationType());
        
        try {
            ClientEventRequest dto = new ClientEventRequest();
            dto.setSessionId(UUID.fromString(request.getSessionId()));
            dto.setEventType(request.getEventType());
            dto.setViolationType(request.getViolationType());
            dto.setViolationState(request.getViolationState());
            dto.setEvidenceUrl(request.getEvidenceUrl());
            dto.setObjectKey(request.getObjectKey());
            dto.setFileSize(request.getFileSize());
            dto.setTimestamp(request.getTimestamp());
            dto.setSource(request.getSource());

            clientEventService.processClientEvent(dto);

            log.info("gRPC client event processed successfully: sessionId={}", request.getSessionId());

            ClientEventGrpcResponse response = ClientEventGrpcResponse.newBuilder()
                    .setSuccess(true)
                    .setMessage("Incident processed successfully via gRPC")
                    .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.error("Failed to process gRPC client event: sessionId={}, error={}", request.getSessionId(), e.getMessage(), e);
            responseObserver.onError(io.grpc.Status.INTERNAL
                    .withDescription("Error processing incident: " + e.getMessage())
                    .asRuntimeException());
        }
    }
}

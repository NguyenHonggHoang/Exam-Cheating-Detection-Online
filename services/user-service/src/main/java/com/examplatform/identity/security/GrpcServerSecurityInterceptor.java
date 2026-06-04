package com.examplatform.identity.security;

import io.grpc.*;
import net.devh.boot.grpc.server.interceptor.GrpcGlobalServerInterceptor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

@Component
@GrpcGlobalServerInterceptor
public class GrpcServerSecurityInterceptor implements ServerInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(GrpcServerSecurityInterceptor.class);

    private static final Metadata.Key<String> AUTHORIZATION_KEY =
            Metadata.Key.of("Authorization", Metadata.ASCII_STRING_MARSHALLER);

    private final JwtDecoder jwtDecoder;
    private final CustomJwtAuthenticationConverter jwtAuthenticationConverter;

    public GrpcServerSecurityInterceptor(@org.springframework.context.annotation.Lazy JwtDecoder jwtDecoder) {
        this.jwtDecoder = jwtDecoder;
        this.jwtAuthenticationConverter = new CustomJwtAuthenticationConverter();
    }

    @Override
    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
            ServerCall<ReqT, RespT> call,
            Metadata headers,
            ServerCallHandler<ReqT, RespT> next) {

        String authHeader = headers.get(AUTHORIZATION_KEY);
        if (authHeader == null || !authHeader.toLowerCase().startsWith("bearer ")) {
            logger.warn("gRPC Call rejected: Missing or invalid Authorization header");
            call.close(Status.UNAUTHENTICATED.withDescription("Missing or invalid Authorization header"), new Metadata());
            return new ServerCall.Listener<ReqT>() {};
        }

        String token = authHeader.substring(7);
        try {
            Jwt jwt = jwtDecoder.decode(token);
            JwtAuthenticationToken authentication = (JwtAuthenticationToken) jwtAuthenticationConverter.convert(jwt);
            
            // Thiết lập SecurityContext
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
            
            logger.debug("gRPC Security Context established for: {}, authorities: {}", 
                    authentication.getName(), authentication.getAuthorities());
            
        } catch (Exception e) {
            logger.error("gRPC Authentication failed: {}", e.getMessage(), e);
            call.close(Status.UNAUTHENTICATED.withDescription("Authentication failed: " + e.getMessage()), new Metadata());
            return new ServerCall.Listener<ReqT>() {};
        }

        // Bọc Listener để đảm bảo SecurityContext được giữ đúng luồng khi xử lý request tiếp theo
        ServerCall.Listener<ReqT> delegate = next.startCall(call, headers);
        return new ForwardingServerCallListener.SimpleForwardingServerCallListener<ReqT>(delegate) {
            @Override
            public void onMessage(ReqT message) {
                try {
                    super.onMessage(message);
                } finally {
                    SecurityContextHolder.clearContext();
                }
            }

            @Override
            public void onHalfClose() {
                try {
                    super.onHalfClose();
                } finally {
                    SecurityContextHolder.clearContext();
                }
            }
        };
    }
}

package com.example.exam.security;

import io.grpc.*;
import net.devh.boot.grpc.client.interceptor.GrpcGlobalClientInterceptor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.client.OAuth2AuthorizeRequest;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.stereotype.Component;

@Component
@GrpcGlobalClientInterceptor
public class GrpcClientTokenInterceptor implements ClientInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(GrpcClientTokenInterceptor.class);

    private static final Metadata.Key<String> AUTHORIZATION_KEY =
            Metadata.Key.of("Authorization", Metadata.ASCII_STRING_MARSHALLER);

    private final OAuth2AuthorizedClientManager authorizedClientManager;

    public GrpcClientTokenInterceptor(OAuth2AuthorizedClientManager authorizedClientManager) {
        this.authorizedClientManager = authorizedClientManager;
    }

    @Override
    public <ReqT, RespT> ClientCall<ReqT, RespT> interceptCall(
            MethodDescriptor<ReqT, RespT> method,
            CallOptions callOptions,
            Channel next) {

        return new ForwardingClientCall.SimpleForwardingClientCall<ReqT, RespT>(next.newCall(method, callOptions)) {
            @Override
            public void start(Listener<RespT> responseListener, Metadata headers) {
                try {
                    // Lấy token tự động qua OAuth2AuthorizedClientManager
                    OAuth2AuthorizeRequest authorizeRequest = OAuth2AuthorizeRequest
                            .withClientRegistrationId("session-service-client")
                            .principal("session-service")
                            .build();

                    OAuth2AuthorizedClient authorizedClient = authorizedClientManager.authorize(authorizeRequest);
                    if (authorizedClient != null) {
                        OAuth2AccessToken accessToken = authorizedClient.getAccessToken();
                        String tokenValue = accessToken.getTokenValue();
                        
                        headers.put(AUTHORIZATION_KEY, "Bearer " + tokenValue);
                        logger.debug("Attached Client Credentials token to gRPC request: {}...", tokenValue.substring(0, 10));
                    } else {
                        logger.warn("Failed to obtain OAuth2 token from AuthorizedClientManager");
                    }
                } catch (Exception e) {
                    logger.error("Error attaching OAuth2 token to gRPC call: {}", e.getMessage(), e);
                }
                super.start(responseListener, headers);
            }
        };
    }
}

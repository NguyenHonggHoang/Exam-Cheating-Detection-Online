package com.example.exam.client;

import com.example.exam.config.OAuth2FeignRequestInterceptor;
import feign.RequestInterceptor;
import org.springframework.context.annotation.Bean;

/**
 * Feign Configuration for UserServiceClient
 * Registers OAuth2 interceptor to inject service tokens
 */
public class UserServiceFeignConfig {

    @Bean
    public RequestInterceptor oauth2FeignRequestInterceptor(OAuth2FeignRequestInterceptor interceptor) {
        return interceptor;
    }
}

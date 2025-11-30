package com.example.exam.client;

import com.example.exam.dto.UserDetailsDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/**
 * Feign Client for calling user-service internal API
 * Automatically authenticated using OAuth2FeignRequestInterceptor (Service Token)
 */
@FeignClient(
    name = "user-service",
    url = "${services.user-service.url}",
    configuration = UserServiceFeignConfig.class
)
public interface UserServiceClient {

    /**
     * Get user details by ID from user-service
     * @param userId UUID string of the user
     * @return User details including username, email, authorities
     */
    @GetMapping("/api/internal/users/{userId}")
    UserDetailsDto getUserById(@PathVariable("userId") String userId);
}

package com.examplatform.admin.service;

import com.examplatform.admin.web.dto.CreateUserRequest;
import com.examplatform.admin.web.dto.UserResponse; 
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.ResponseEntity;

@Service
public class UserManagementService {

    private final RestTemplate restTemplate;
    
    @Value("${app.services.user-service-url:http://localhost:8100}")
    private String userServiceUrl;

    public UserManagementService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public UserResponse createUser(CreateUserRequest request) {
        try {
            String url = userServiceUrl + "/api/internal/users";
            ResponseEntity<UserResponse> response = restTemplate.postForEntity(url, request, UserResponse.class);
            return response.getBody();
        } catch (RestClientException e) {
            throw new RuntimeException("Error creating user: " + e.getMessage(), e);
        }
    }
}
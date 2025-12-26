package com.examplatform.admin.service;

import com.examplatform.admin.web.dto.CreateUserRequest;
import com.examplatform.admin.web.dto.UserResponse; 
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.http.ResponseEntity;

@Service
public class UserManagementService {

    private final RestTemplate restTemplate;
    
    @Value("${app.services.user-service-url:http://localhost:8100}")
    private String userServiceUrl;

    public UserManagementService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public UserResponse createUser(CreateUserRequest request, Jwt jwt) {
        try {
            String url = userServiceUrl + "/api/internal/users";
            
            // Token Relay
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(jwt.getTokenValue());
            
            HttpEntity<CreateUserRequest> entity = new HttpEntity<>(request, headers);
            
            ResponseEntity<UserResponse> response = restTemplate.exchange(url, HttpMethod.POST, entity, UserResponse.class);
            return response.getBody();
        } catch (Exception e) {
            System.err.println("Error creating user: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Error creating user: " + e.getMessage(), e);
        }
    }

    public Object listUsers(int page, int size, String role, Jwt jwt) {
        try {
            // Build URL with query params
            org.springframework.web.util.UriComponentsBuilder builder = org.springframework.web.util.UriComponentsBuilder
                .fromHttpUrl(userServiceUrl + "/api/users")
                .queryParam("page", page)
                .queryParam("size", size);
                
            if (role != null && !role.isEmpty()) {
                builder.queryParam("role", role);
            }
            
            String url = builder.toUriString();
            
            // Token Relay
            HttpHeaders headers = new HttpHeaders();
            String token = jwt.getTokenValue();
            System.out.println("Relaying token to user-service: " + (token != null ? token.substring(0, 10) + "..." : "null"));
            
            headers.setBearerAuth(token);
            
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            
            // Return raw object (JSON node)
            return restTemplate.exchange(url, HttpMethod.GET, entity, Object.class).getBody();
        } catch (Exception e) {
            System.err.println("Error listing users: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Error listing users: " + e.getMessage(), e);
        }
    }
}
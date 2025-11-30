package com.examplatform.admin.exception;

public class ClientNotFoundException extends RuntimeException {
    public ClientNotFoundException(String clientId) {
        super("OAuth client not found: " + clientId);
    }
}


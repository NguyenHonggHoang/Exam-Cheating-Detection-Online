package com.example.exam.exception;

/**
 * Exception thrown when session validation fails
 */
public class InvalidSessionException extends RuntimeException {
    public InvalidSessionException(String message) {
        super(message);
    }
    
    public InvalidSessionException(String message, Throwable cause) {
        super(message, cause);
    }
}

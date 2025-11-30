package com.example.exam.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Filter to add request ID and session ID to MDC for structured logging
 */
@Component
public class LoggingMDCFilter extends OncePerRequestFilter {

    private static final String REQUEST_ID = "requestId";
    private static final String SESSION_ID = "sessionId";
    private static final String USER_ID = "userId";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            // Generate or get request ID
            String requestId = request.getHeader("X-Request-ID");
            if (requestId == null || requestId.isBlank()) {
                requestId = UUID.randomUUID().toString();
            }
            MDC.put(REQUEST_ID, requestId);
            response.setHeader("X-Request-ID", requestId);

            // Extract session ID from query param or header (if present)
            String sessionId = request.getParameter("sessionId");
            if (sessionId == null || sessionId.isBlank()) {
                sessionId = request.getHeader("X-Session-ID");
            }
            if (sessionId != null && !sessionId.isBlank()) {
                MDC.put(SESSION_ID, sessionId);
            }

            // Continue filter chain
            filterChain.doFilter(request, response);
        } finally {
            // Clean up MDC
            MDC.remove(REQUEST_ID);
            MDC.remove(SESSION_ID);
            MDC.remove(USER_ID);
        }
    }
}

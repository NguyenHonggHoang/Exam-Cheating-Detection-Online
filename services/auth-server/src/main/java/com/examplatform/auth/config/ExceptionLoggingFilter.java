package com.examplatform.auth.config;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@Order(1)
public class ExceptionLoggingFilter implements Filter {
    private static final Logger logger = LoggerFactory.getLogger(ExceptionLoggingFilter.class);

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        try {
            chain.doFilter(request, response);
        } catch (Throwable ex) {
            try {
                logger.error("Unhandled exception for request {} {}", req.getMethod(), req.getRequestURI(), ex);
            } catch (Exception logEx) {
                // best-effort logging
                ex.printStackTrace();
            }
            // rethrow so normal error handling still occurs (Whitelabel / error controller)
            if (ex instanceof ServletException) throw (ServletException) ex;
            if (ex instanceof IOException) throw (IOException) ex;
            throw new ServletException(ex);
        }
    }
}

package com.examplatform.identity.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI identityOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Identity & User Management Service API")
                        .description("Endpoints for user registration, profile retrieval, and gRPC identity communication")
                        .version("v1")
                        .contact(new Contact().name("Exam Identity Team").email("identity-team@example.com"))
                        .license(new License().name("MIT"))
                );
    }
}

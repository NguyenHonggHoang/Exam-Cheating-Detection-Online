package com.example.exam.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI incidentOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Incident Service API")
                        .description("Endpoints for reporting, processing, and checking cheating incidents and telemetry data")
                        .version("v1")
                        .contact(new Contact().name("Exam Security Team").email("security-team@example.com"))
                        .license(new License().name("MIT"))
                );
    }
}

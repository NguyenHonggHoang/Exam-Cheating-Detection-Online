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
    public OpenAPI examOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Exam Cheating Detection API")
                        .description("Endpoints for managing exam sessions and related operations")
                        .version("v1")
                        .contact(new Contact().name("Exam Team").email("team@example.com"))
                        .license(new License().name("MIT"))
                );
    }
}

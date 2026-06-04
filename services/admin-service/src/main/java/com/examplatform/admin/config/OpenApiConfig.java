package com.examplatform.admin.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI adminOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Admin Service API")
                        .description("Endpoints for administrative management, seed client registration, and system control")
                        .version("v1")
                        .contact(new Contact().name("Exam Admin Team").email("admin-team@example.com"))
                        .license(new License().name("MIT"))
                );
    }
}

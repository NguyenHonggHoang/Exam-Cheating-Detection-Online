package com.examplatform.auth.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI authOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Authorization Server API")
                        .description("Endpoints for OAuth2/OIDC token authorization, public keys (JWKS), and authentication consent")
                        .version("v1")
                        .contact(new Contact().name("Exam Auth Team").email("auth-team@example.com"))
                        .license(new License().name("MIT"))
                );
    }
}

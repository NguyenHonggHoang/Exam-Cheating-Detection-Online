package com.examplatform.auth.config;

import com.examplatform.auth.crypto.Jwks;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.authorization.JdbcOAuth2AuthorizationConsentService;
import org.springframework.security.oauth2.server.authorization.JdbcOAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationConsentService;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.client.JdbcRegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.config.annotation.web.configuration.OAuth2AuthorizationServerConfiguration;
import org.springframework.security.oauth2.server.authorization.config.annotation.web.configurers.OAuth2AuthorizationServerConfigurer;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenCustomizer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.LoginUrlAuthenticationEntryPoint;
import org.springframework.security.web.util.matcher.MediaTypeRequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Configuration
@EnableWebSecurity
public class AuthorizationServerSecurityConfig {

    private final AuthServerProperties properties;
    private static final Logger logger = LoggerFactory.getLogger(AuthorizationServerSecurityConfig.class);

    public AuthorizationServerSecurityConfig(AuthServerProperties properties) {
        this.properties = properties;
    }

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public SecurityFilterChain authorizationServerSecurityFilterChain(HttpSecurity http) throws Exception {
        OAuth2AuthorizationServerConfiguration.applyDefaultSecurity(http);
        http.getConfigurer(OAuth2AuthorizationServerConfigurer.class)
            .authorizationEndpoint(auth -> auth.consentPage("/oauth2/consent"))
            .oidc(Customizer.withDefaults()); 

        http.exceptionHandling(ex -> ex.defaultAuthenticationEntryPointFor(
                new LoginUrlAuthenticationEntryPoint("/login"),
                new MediaTypeRequestMatcher(MediaType.TEXT_HTML)))
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
            .cors(Customizer.withDefaults()); 

        return http.build();
    }

    @Bean
    @Order(2)
    public SecurityFilterChain appSecurityFilterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/**", "/login", "/error", "/oauth2/consent").permitAll()
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html").permitAll()
                .anyRequest().authenticated())
            .formLogin(form -> form
                .loginPage("/login")
                .permitAll())
            .logout(logout -> logout
                .logoutUrl("/logout") 
                .logoutSuccessUrl("http://localhost:5173") 
                .invalidateHttpSession(true)
                .clearAuthentication(true)
                .deleteCookies("JSESSIONID")
                .permitAll())
            .cors(Customizer.withDefaults());
        
        return http.build();
    }

    @Bean
    public OAuth2TokenCustomizer<JwtEncodingContext> authoritiesClaimCustomizer() {
        return context -> {
            logger.info("Token customizer called for token type: {} and grant type: {}", 
                    context.getTokenType().getValue(), context.getAuthorizationGrantType().getValue());
            
            org.springframework.security.oauth2.core.AuthorizationGrantType grantType = context.getAuthorizationGrantType();
            
            if (org.springframework.security.oauth2.core.AuthorizationGrantType.CLIENT_CREDENTIALS.equals(grantType)) {
                String clientId = context.getRegisteredClient().getClientId();
                java.util.List<String> roles = new java.util.ArrayList<>();
                java.util.List<String> permissions = new java.util.ArrayList<>();
                
                if ("admin-service".equals(clientId)) {
                    roles.add("ROLE_ADMIN");
                    permissions.add("user.create");
                    permissions.add("user.read");
                    permissions.add("exam.manage");
                } else if ("session-service".equals(clientId)) {
                    roles.add("ROLE_PROCTOR");
                    permissions.add("incident.create");
                } else if ("incident-service".equals(clientId)) {
                    roles.add("ROLE_PROCTOR");
                    permissions.add("incident.read");
                    permissions.add("incident.write");
                } else if ("auth-service".equals(clientId)) {
                    // auth-service được gọi user-service
                    permissions.add("user.read");
                }
                
                context.getClaims()
                       .claim("roles", roles)
                       .claim("permissions", permissions);
                       
                logger.info("Client Credentials Token Customizer: client={}, roles={}, permissions={}", clientId, roles, permissions);
            } else {
                Authentication principal = context.getPrincipal();
                if (principal != null) {
                    Set<String> authorities = principal.getAuthorities().stream()
                            .map(GrantedAuthority::getAuthority)
                            .collect(Collectors.toSet());

                    Set<String> mappedRoles = authorities.stream()
                            .map(role -> {
                                if ("ROLE_CANDIDATE".equals(role)) return "ROLE_STUDENT";
                                return role;
                            })
                            .collect(Collectors.toSet());

                    context.getClaims().claim("roles", mappedRoles);
                    
                    java.util.List<String> permissions = new java.util.ArrayList<>();
                    if (mappedRoles.contains("ROLE_ADMIN")) {
                        permissions.add("user.create");
                        permissions.add("user.read");
                        permissions.add("exam.manage");
                    } else if (mappedRoles.contains("ROLE_PROCTOR")) {
                        permissions.add("incident.read");
                        permissions.add("incident.write");
                    } else if (mappedRoles.contains("ROLE_STUDENT")) {
                        permissions.add("exam.read");
                    }
                    context.getClaims().claim("permissions", permissions);

                    // Dynamically assign scopes based on user roles in the database
                    Set<String> scopes = new java.util.HashSet<>(context.getAuthorizedScopes());
                    if (mappedRoles.contains("ROLE_ADMIN")) {
                        scopes.add("exam.read");
                        scopes.add("exam.write");
                    } else if (mappedRoles.contains("ROLE_PROCTOR")) {
                        scopes.add("exam.read");
                        scopes.add("exam.write");
                    } else if (mappedRoles.contains("ROLE_STUDENT")) {
                        scopes.add("exam.read");
                    }
                    context.getClaims().claim("scope", scopes);

                    logger.info("User Login Token Customizer: principal={}, roles={}, permissions={}, scopes={}", 
                            principal.getName(), mappedRoles, permissions, scopes);
                }
            }
        };
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    public RegisteredClientRepository registeredClientRepository(JdbcTemplate jdbcTemplate) {
        return new JdbcRegisteredClientRepository(jdbcTemplate);
    }

    @Bean
    public OAuth2AuthorizationService authorizationService(JdbcTemplate jdbcTemplate,
                                                           RegisteredClientRepository registeredClientRepository) {
        return new JdbcOAuth2AuthorizationService(jdbcTemplate, registeredClientRepository);
    }

    @Bean
    public OAuth2AuthorizationConsentService authorizationConsentService(JdbcTemplate jdbcTemplate,
                                                                       RegisteredClientRepository registeredClientRepository) {
        return new JdbcOAuth2AuthorizationConsentService(jdbcTemplate, registeredClientRepository);
    }

    @Bean
    public AuthorizationServerSettings authorizationServerSettings() {
        return AuthorizationServerSettings.builder()
                .issuer(properties.issuer())
                .build();
    }

    @Bean
    public JWKSource<SecurityContext> jwkSource() {
        JWKSet jwkSet = new JWKSet(Jwks.generateRsa());
        return (selector, securityContext) -> selector.select(jwkSet);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        CorsConfiguration config = new CorsConfiguration();
        config.addAllowedHeader("*");
        config.addAllowedMethod("*");
        config.setAllowCredentials(true);
        if (properties.cors() != null && properties.cors().allowedOrigins() != null) {
            config.setAllowedOrigins(List.of(properties.cors().allowedOrigins()));
        } else {
             config.addAllowedOrigin("http://localhost:5173");
        }
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
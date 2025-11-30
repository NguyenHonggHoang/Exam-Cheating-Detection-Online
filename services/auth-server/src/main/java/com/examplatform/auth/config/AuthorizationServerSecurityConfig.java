// package com.examplatform.auth.config;

// import com.examplatform.auth.crypto.Jwks;
// import com.fasterxml.jackson.core.JsonParser;
// import com.fasterxml.jackson.databind.DeserializationContext;
// import com.fasterxml.jackson.databind.JsonDeserializer;
// import com.fasterxml.jackson.databind.JsonNode;
// import com.fasterxml.jackson.databind.Module;
// import com.fasterxml.jackson.databind.ObjectMapper;
// import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
// import com.nimbusds.jose.jwk.JWKSet;
// import com.nimbusds.jose.jwk.source.JWKSource;
// import com.nimbusds.jose.proc.SecurityContext;
// import org.springframework.context.annotation.Bean;
// import org.springframework.context.annotation.Configuration;
// import org.springframework.core.Ordered;
// import org.springframework.core.annotation.Order;
// import org.springframework.http.MediaType;
// import org.springframework.jdbc.core.JdbcTemplate;
// import org.springframework.jdbc.support.lob.DefaultLobHandler;
// import org.springframework.jdbc.support.lob.LobHandler;
// import org.springframework.security.config.Customizer;
// import org.springframework.security.config.annotation.web.builders.HttpSecurity;
// import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
// import org.springframework.security.oauth2.server.authorization.config.annotation.web.configuration.OAuth2AuthorizationServerConfiguration;
// import org.springframework.security.oauth2.server.authorization.config.annotation.web.configurers.OAuth2AuthorizationServerConfigurer;
// import org.springframework.security.crypto.factory.PasswordEncoderFactories;
// import org.springframework.security.crypto.password.PasswordEncoder;
// import org.springframework.security.jackson2.SecurityJackson2Modules;
// import org.springframework.security.oauth2.server.authorization.JdbcOAuth2AuthorizationConsentService;
// import org.springframework.security.oauth2.server.authorization.JdbcOAuth2AuthorizationService;
// import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationConsentService;
// import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
// import org.springframework.security.oauth2.server.authorization.client.JdbcRegisteredClientRepository;
// import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
// import org.springframework.security.oauth2.server.authorization.jackson2.OAuth2AuthorizationServerJackson2Module;
// import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
// import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;
// import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenCustomizer;
// import org.springframework.security.web.SecurityFilterChain;
// import org.springframework.security.web.authentication.LoginUrlAuthenticationEntryPoint;
// import org.springframework.security.web.util.matcher.MediaTypeRequestMatcher;
// import org.springframework.web.cors.CorsConfiguration;
// import org.springframework.web.cors.CorsConfigurationSource;
// import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
// import org.slf4j.Logger;
// import org.slf4j.LoggerFactory;

// import java.io.IOException;
// import java.util.ArrayList;
// import java.util.List;

// @Configuration
// @EnableWebSecurity
// public class AuthorizationServerSecurityConfig {

//     private final AuthServerProperties properties;

//     private static final Logger logger = LoggerFactory.getLogger(AuthorizationServerSecurityConfig.class);

//     public AuthorizationServerSecurityConfig(AuthServerProperties properties) {
//         this.properties = properties;
//     }

//     // ---------- JSON deserializer for Spring security modules ----------
//     public static class SmartListDeserializer extends JsonDeserializer<List<?>> {
//         @Override
//         public List<?> deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
//             ObjectMapper mapper = (ObjectMapper) p.getCodec();
//             JsonNode node = mapper.readTree(p);
//             List<Object> result = new ArrayList<>();
//             if (node.isArray()) {
//                 for (JsonNode element : node) {
//                     if (element.isArray() && element.size() == 2 && element.get(0).isTextual()) {
//                         try {
//                             String className = element.get(0).asText();
//                             Class.forName(className);
//                             JsonNode valueNode = element.get(1);
//                             result.add(mapper.treeToValue(valueNode, Object.class));
//                             continue;
//                         } catch (Exception e) {
//                             // ignore and fall back
//                         }
//                     }
//                     result.add(mapper.treeToValue(element, Object.class));
//                 }
//             }
//             return result;
//         }
//     }

//     @JsonDeserialize(using = SmartListDeserializer.class)
//     public abstract class SafeListMixin {}

//     // ---------- Security filter chains ----------
//     @Bean
//     @Order(Ordered.HIGHEST_PRECEDENCE)
//     public SecurityFilterChain authorizationServerSecurityFilterChain(HttpSecurity http) throws Exception {
//         OAuth2AuthorizationServerConfiguration.applyDefaultSecurity(http);
//         http.getConfigurer(OAuth2AuthorizationServerConfigurer.class)
//                 .authorizationEndpoint(auth -> auth.consentPage("/oauth2/consent"))
//                 .oidc(oidc -> oidc.logoutEndpoint(Customizer.withDefaults()));
//         http.exceptionHandling(ex -> ex.defaultAuthenticationEntryPointFor(
//                 new LoginUrlAuthenticationEntryPoint("/login"),
//                 new MediaTypeRequestMatcher(MediaType.TEXT_HTML)))
//             .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
//             .csrf(csrf -> csrf.ignoringRequestMatchers("/connect/logout"))
//             .cors(Customizer.withDefaults());
//         return http.build();
//     }

//     @Bean
//     @Order(2)
//     public SecurityFilterChain appSecurityFilterChain(HttpSecurity http) throws Exception {
//         String origin = "http://localhost:5174";
//         try {
//             if (properties.cors() != null && properties.cors().allowedOrigins() != null &&
//                 properties.cors().allowedOrigins().length > 0) {
//                 if (properties.spaClient() != null && properties.spaClient().redirectUri() != null) {
//                     java.net.URI uri = java.net.URI.create(properties.spaClient().redirectUri());
//                     origin = uri.getScheme() + "://" + uri.getAuthority();
//                 } else {
//                     origin = properties.cors().allowedOrigins()[0];
//                 }
//             }
//         } catch (Exception ignored) {}
//         final String spaDefaultOrigin = origin;
//         http.authorizeHttpRequests(auth -> auth
//                 .requestMatchers("/actuator/health", "/actuator/info", "/login", "/oauth2/consent", "/error").permitAll()
//                 .anyRequest().authenticated())
//             .formLogin(form -> form
//                 .loginPage("/login")
//                 .defaultSuccessUrl(spaDefaultOrigin)
//                 .permitAll())
//             .logout(logout -> logout
//                 .logoutRequestMatcher(new org.springframework.security.web.util.matcher.AntPathRequestMatcher("/logout", "GET"))
//                 .logoutSuccessHandler((request, response, authentication) -> {
//                     String redirectUrl = request.getParameter("post_logout_redirect_uri");
//                     if (redirectUrl == null || redirectUrl.isEmpty()) {
//                         redirectUrl = request.getParameter("redirect_uri");
//                     }
//                     if (redirectUrl == null || redirectUrl.isEmpty()) {
//                         redirectUrl = spaDefaultOrigin;
//                     }
//                     response.sendRedirect(redirectUrl);
//                 })
//                 .permitAll())
//             .csrf(csrf -> csrf.ignoringRequestMatchers("/logout", "/login"));
//         return http.build();
//     }

//     // ---------- Beans ----------
//     @Bean
//     public PasswordEncoder passwordEncoder() {
//         return PasswordEncoderFactories.createDelegatingPasswordEncoder();
//     }

//     @Bean
//     public RegisteredClientRepository registeredClientRepository(JdbcTemplate jdbcTemplate) {
//         return new JdbcRegisteredClientRepository(jdbcTemplate);
//     }

//     @Bean
//     public LobHandler lobHandler() {
//         return new DefaultLobHandler();
//     }

//     @Bean
//     public OAuth2AuthorizationService authorizationService(JdbcTemplate jdbcTemplate,
//                                                          RegisteredClientRepository registeredClientRepository,
//                                                          LobHandler lobHandler) {
//         JdbcOAuth2AuthorizationService service = new JdbcOAuth2AuthorizationService(jdbcTemplate, registeredClientRepository);
//         JdbcOAuth2AuthorizationService.OAuth2AuthorizationRowMapper rowMapper = new JdbcOAuth2AuthorizationService.OAuth2AuthorizationRowMapper(registeredClientRepository);
//         rowMapper.setLobHandler(lobHandler);
//         ObjectMapper objectMapper = new ObjectMapper();
//         ClassLoader cl = JdbcOAuth2AuthorizationService.class.getClassLoader();
//         List<Module> modules = SecurityJackson2Modules.getModules(cl);
//         objectMapper.registerModules(modules);
//         objectMapper.registerModule(new OAuth2AuthorizationServerJackson2Module());
//         objectMapper.configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_INVALID_SUBTYPE, false);
//         objectMapper.configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
//         try {
//             objectMapper.addMixIn(Class.forName("java.util.ImmutableCollections$ListN"), SafeListMixin.class);
//             objectMapper.addMixIn(Class.forName("java.util.ImmutableCollections$List12"), SafeListMixin.class);
//         } catch (ClassNotFoundException ignored) {}
//         rowMapper.setObjectMapper(objectMapper);
//         service.setAuthorizationRowMapper(rowMapper);
//         // Wrap the JDBC service so we can enrich saved Authorizations with the user's authorities
//         org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService delegating = new org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService() {
//             @Override
//             public void save(org.springframework.security.oauth2.server.authorization.OAuth2Authorization authorization) {
//                 try {
//                     var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
//                     if (auth != null && auth.isAuthenticated() && !(auth instanceof org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken)) {
//                         java.util.List<String> authorities = auth.getAuthorities().stream()
//                                 .map(a -> a.getAuthority())
//                                 .collect(java.util.stream.Collectors.toList());
//                         authorization = org.springframework.security.oauth2.server.authorization.OAuth2Authorization.from(authorization)
//                                 .attribute("authorities", authorities)
//                                 .build();
//                     }
//                 } catch (Exception e) {
//                     logger.debug("Error enriching authorization with authorities", e);
//                 }
//                 service.save(authorization);
//             }

//             @Override
//             public void remove(org.springframework.security.oauth2.server.authorization.OAuth2Authorization authorization) {
//                 service.remove(authorization);
//             }

//             @Override
//             public org.springframework.security.oauth2.server.authorization.OAuth2Authorization findById(String id) {
//                 return service.findById(id);
//             }

//             @Override
//             public org.springframework.security.oauth2.server.authorization.OAuth2Authorization findByToken(String token, org.springframework.security.oauth2.server.authorization.OAuth2TokenType tokenType) {
//                 return service.findByToken(token, tokenType);
//             }
//         };

//         return delegating;
//     }

//     @Bean
//     public OAuth2AuthorizationConsentService authorizationConsentService(JdbcTemplate jdbcTemplate,
//                                                                        RegisteredClientRepository registeredClientRepository) {
//         return new JdbcOAuth2AuthorizationConsentService(jdbcTemplate, registeredClientRepository);
//     }

//     @Bean
//     public AuthorizationServerSettings authorizationServerSettings() {
//         return AuthorizationServerSettings.builder()
//                 .issuer(properties.issuer())
//                 .build();
//     }

//     @Bean
//     public JWKSource<SecurityContext> jwkSource() {
//         JWKSet jwkSet = new JWKSet(Jwks.generateRsa());
//         return (selector, securityContext) -> selector.select(jwkSet);
//     }

//     @Bean
//     public CorsConfigurationSource corsConfigurationSource() {
//         List<String> allowedOrigins = properties.cors() != null && properties.cors().allowedOrigins() != null
//                 ? List.of(properties.cors().allowedOrigins())
//                 : List.of("http://localhost:5173", "http://localhost:5174");
//         CorsConfiguration configuration = new CorsConfiguration();
//         configuration.setAllowedOrigins(allowedOrigins);
//         configuration.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
//         configuration.setAllowedHeaders(List.of("*"));
//         configuration.setAllowCredentials(true);
//         UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
//         source.registerCorsConfiguration("/**", configuration);
//         return source;
//     }

//     @Bean
//     public OAuth2TokenCustomizer<JwtEncodingContext> authoritiesClaimCustomizer() {
//         return context -> {
//             logger.debug("Starting token customization: grant={} tokenType={} principal={}", context.getAuthorizationGrantType(), context.getTokenType(),
//                     context.getPrincipal() == null ? "<null>" : context.getPrincipal().getClass().getName());

//             if (context.getPrincipal() == null) {
//                 logger.debug("No principal available for token customization (grant={} tokenType={})",
//                         context.getAuthorizationGrantType(), context.getTokenType());
//                 return;
//             }

//             java.util.List<String> authorities = java.util.Collections.emptyList();

//             if (context.getPrincipal() instanceof org.springframework.security.core.Authentication) {
//                 org.springframework.security.core.Authentication auth = (org.springframework.security.core.Authentication) context.getPrincipal();
//                 authorities = auth.getAuthorities().stream()
//                         .map(a -> a.getAuthority())
//                         .collect(java.util.stream.Collectors.toList());
//             } else if (context.getPrincipal() instanceof org.springframework.security.oauth2.core.user.OAuth2User) {
//                 org.springframework.security.oauth2.core.user.OAuth2User oauth2User = (org.springframework.security.oauth2.core.user.OAuth2User) context.getPrincipal();
//                 authorities = oauth2User.getAuthorities().stream()
//                         .map(a -> a.getAuthority())
//                         .collect(java.util.stream.Collectors.toList());
//             }

//             // If not found on the principal, log authorization attributes to help debug
//             if ((authorities == null || authorities.isEmpty()) && context.getAuthorization() != null) {
//                 try {
//                     var auth = context.getAuthorization();
//                     logger.debug("Authorization id={} principalName={} attributesKeys={}", auth.getId(), auth.getPrincipalName(), auth.getAttributes().keySet());

//                     // Fallback: check if the Authorization has an "authorities" attribute saved earlier
//                     Object attr = auth.getAttribute("authorities");
//                     if ((attr == null || (attr instanceof java.util.Collection && ((java.util.Collection<?>) attr).isEmpty())) == false) {
//                         java.util.List<String> fromAttr = new java.util.ArrayList<>();
//                         if (attr instanceof java.util.Collection) {
//                             for (Object o : (java.util.Collection<?>) attr) {
//                                 if (o != null) fromAttr.add(String.valueOf(o));
//                             }
//                         } else if (attr.getClass().isArray()) {
//                             for (Object o : (Object[]) attr) {
//                                 if (o != null) fromAttr.add(String.valueOf(o));
//                             }
//                         } else {
//                             fromAttr.add(String.valueOf(attr));
//                         }

//                         if (!fromAttr.isEmpty()) {
//                             authorities = fromAttr;
//                             logger.debug("Using authorities from authorization attribute: {}", authorities);
//                         }
//                     }
//                 } catch (Exception e) {
//                     logger.debug("Error inspecting authorization attributes", e);
//                 }
//             }

//             logger.debug("Token customization result: grantType={} tokenType={} principalClass={} authorities={}",
//                     context.getAuthorizationGrantType(), context.getTokenType(), context.getPrincipal().getClass().getName(), authorities);

//             if (authorities != null && !authorities.isEmpty()) {
//                 context.getClaims().claim("authorities", authorities);
//             }
//         };
//     }
// }

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
                .anyRequest().authenticated())
            .formLogin(form -> form
                .loginPage("/login")
                .permitAll())
            .logout(logout -> logout
                .logoutSuccessUrl("/login?logout") // Logout xong quay về login
                .permitAll())
            .cors(Customizer.withDefaults());
        
        return http.build();
    }

    @Bean
    public OAuth2TokenCustomizer<JwtEncodingContext> authoritiesClaimCustomizer() {
        return context -> {
            if (org.springframework.security.oauth2.server.authorization.OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType())) {
                Authentication principal = context.getPrincipal();
                
                Set<String> authorities = principal.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .collect(Collectors.toSet());

                if (!authorities.isEmpty()) {
                    context.getClaims().claim("authorities", authorities);
                    logger.debug("Added authorities to token: {}", authorities);
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
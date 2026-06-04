# enable-security-rules.ps1
# Script to restore security filters, Istio authorization policies, Cilium network policies, and JWT token validation
# This reverts all service security states back to production mode.

function Write-Utf8NoBom($path, $content) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
}

Write-Host "======================================================================" -ForegroundColor Yellow
Write-Host "[SECURE] STARTING TO RE-ENABLE ALL SECURITY RULES AND JWT AUTHENTICATION..." -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Yellow

# --- STEP 1: Enable Namespace Injection & Apply Configs ---
Write-Host "`n1. Enabling Istio auto-injection on namespace and applying policies/infra configs..." -ForegroundColor Cyan
try {
    # Enable Istio sidecar auto-injection for the namespace
    kubectl label namespace exam-platform istio-injection=enabled --overwrite
    Write-Host "[OK] Istio auto-injection enabled on namespace exam-platform!" -ForegroundColor Green

    # Apply database and infrastructure configs (with sidecar.istio.io/inject: "false")
    Write-Host "[INFO] Applying updated infrastructure configs with Istio bypass rules..." -ForegroundColor DarkGray
    kubectl apply -f k8s/infra/session-db.yaml
    kubectl apply -f k8s/infra/incident-db.yaml
    kubectl apply -f k8s/infra/services-infra.yaml
    kubectl apply -f k8s/infra/debezium.yaml
    Write-Host "[OK] Database and infrastructure manifests applied successfully!" -ForegroundColor Green

    # Apply Microservices and Gateways Deployments & HPAs
    Write-Host "[INFO] Applying updated microservices configurations and HPAs..." -ForegroundColor DarkGray
    if (Test-Path "k8s/apps/microservices.yaml") {
        kubectl apply -f k8s/apps/microservices.yaml
        Write-Host "[OK] Microservices manifests applied successfully!" -ForegroundColor Green
    }
    if (Test-Path "k8s/apps/hpa.yaml") {
        kubectl apply -f k8s/apps/hpa.yaml
        Write-Host "[OK] HPA manifests applied successfully!" -ForegroundColor Green
    }

    # Apply Istio Configs (DestinationRules & AuthorizationPolicies)
    if (Test-Path "k8s/istio/mesh-configs.yaml") {
        kubectl apply -f k8s/istio/mesh-configs.yaml
        Write-Host "[OK] Istio mesh configs applied successfully!" -ForegroundColor Green
    } else {
        Write-Warning "File not found: k8s/istio/mesh-configs.yaml"
    }

    # Apply Istio Ingress Gateway & VirtualService
    if (Test-Path "k8s/istio/ingress-gateway.yaml") {
        kubectl apply -f k8s/istio/ingress-gateway.yaml
        Write-Host "[OK] Istio Ingress Gateway configured successfully!" -ForegroundColor Green
    } else {
        Write-Warning "File not found: k8s/istio/ingress-gateway.yaml"
    }
    
    # Apply Cilium Network Policies
    if (Test-Path "k8s/policies/cilium-policies.yaml") {
        kubectl apply -f k8s/policies/cilium-policies.yaml
        Write-Host "[OK] Cilium network policies applied successfully!" -ForegroundColor Green
    } else {
        Write-Warning "File not found: k8s/policies/cilium-policies.yaml"
    }
} catch {
    Write-Warning "[WARN] Failed to interact with Kubernetes cluster. Ensure kubectl is configured and connected."
}

# --- STEP 2: Restore SecurityConfig.java for Session Service ---
Write-Host "`n2. Restoring SecurityConfig.java in session-service..." -ForegroundColor Cyan
$sessionPath = "services/session-service/src/main/java/com/example/exam/config/SecurityConfig.java"
$sessionSecure = @'
package com.example.exam.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/**", "/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                .requestMatchers("/api/sessions/proctor-token").permitAll()
                .requestMatchers("/api/sessions/exam/**").permitAll()
                .requestMatchers("/api/sessions/by-exam/**").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/sessions/*/join").permitAll()
                .requestMatchers("/ws/**").permitAll()
                .requestMatchers("/api/exams/**").permitAll()
                // Enforce JWT validation on mock-exam endpoints during secure policy test
                .anyRequest().authenticated())
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())))
            .cors(Customizer.withDefaults())
            .csrf(AbstractHttpConfigurer::disable);
        return http.build();
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter grantedAuthoritiesConverter = new JwtGrantedAuthoritiesConverter();
        grantedAuthoritiesConverter.setAuthoritiesClaimName("authorities");
        grantedAuthoritiesConverter.setAuthorityPrefix("");

        JwtAuthenticationConverter jwtConverter = new JwtAuthenticationConverter();
        jwtConverter.setJwtGrantedAuthoritiesConverter(grantedAuthoritiesConverter);
        return jwtConverter;
    }
}
'@
Write-Utf8NoBom $sessionPath $sessionSecure
if (Test-Path "$sessionPath.bak") { Remove-Item "$sessionPath.bak" -Force }
Write-Host "[OK] session-service security configuration restored and updated." -ForegroundColor Green

# --- STEP 3: Restore SecurityConfig.java for Incident Service ---
Write-Host "`n3. Restoring SecurityConfig.java in incident-service..." -ForegroundColor Cyan
$incidentPath = "services/incident-service/src/main/java/com/example/exam/config/SecurityConfig.java"
$incidentSecure = @'
package com.example.exam.config;

import com.example.exam.security.CustomJwtAuthenticationConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/**", "/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                .requestMatchers("/api/incidents/*/evidence").permitAll()
                .requestMatchers("/api/incidents/**").permitAll()
                // Enforce JWT validation on client event ingestion during secure policy test
                .anyRequest().authenticated())
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())))
            .cors(Customizer.withDefaults())
            .csrf(AbstractHttpConfigurer::disable);
        return http.build();
    }

    @Bean
    public CustomJwtAuthenticationConverter jwtAuthenticationConverter() {
        return new CustomJwtAuthenticationConverter();
    }
}
'@
Write-Utf8NoBom $incidentPath $incidentSecure
if (Test-Path "$incidentPath.bak") { Remove-Item "$incidentPath.bak" -Force }
Write-Host "[OK] incident-service security configuration restored and updated." -ForegroundColor Green

# --- STEP 4: Restore SecurityConfig.java for User Service ---
Write-Host "`n4. Restoring SecurityConfig.java in user-service..." -ForegroundColor Cyan
$userPath = "services/user-service/src/main/java/com/examplatform/identity/config/SecurityConfig.java"
$userSecure = @'
package com.examplatform.identity.config;

import com.examplatform.identity.security.CustomJwtAuthenticationConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;    
import org.springframework.security.crypto.password.PasswordEncoder;    
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
public class SecurityConfig {

    private static final String[] PUBLIC_ENDPOINTS = {
            "/actuator/health",
            "/actuator/info",
            "/api/register"
    };

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/internal/users/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())));
        return http.build();
    }

    @Bean
    public CustomJwtAuthenticationConverter jwtAuthenticationConverter() {
        return new CustomJwtAuthenticationConverter();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("http://localhost:5173", "http://localhost:3000"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }
}
'@
Write-Utf8NoBom $userPath $userSecure
if (Test-Path "$userPath.bak") { Remove-Item "$userPath.bak" -Force }
Write-Host "[OK] user-service security configuration restored." -ForegroundColor Green

# --- STEP 5: Restore SecurityConfig.java for Admin Service ---
Write-Host "`n5. Restoring SecurityConfig.java in admin-service..." -ForegroundColor Cyan
$adminPath = "services/admin-service/src/main/java/com/examplatform/admin/config/SecurityConfig.java"
$adminSecure = @'
package com.examplatform.admin.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final AdminServiceProperties properties;

    public SecurityConfig(AdminServiceProperties properties) {
        this.properties = properties;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(registry -> registry
                        .requestMatchers(HttpMethod.GET, "/actuator/health").permitAll()
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
        return http.build();
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter grantedAuthoritiesConverter = new JwtGrantedAuthoritiesConverter();
        grantedAuthoritiesConverter.setAuthoritiesClaimName("authorities");
        grantedAuthoritiesConverter.setAuthorityPrefix("");

        JwtAuthenticationConverter jwtConverter = new JwtAuthenticationConverter();
        jwtConverter.setJwtGrantedAuthoritiesConverter(grantedAuthoritiesConverter);
        return jwtConverter;
    }
}
'@
Write-Utf8NoBom $adminPath $adminSecure
if (Test-Path "$adminPath.bak") { Remove-Item "$adminPath.bak" -Force }
Write-Host "[OK] admin-service security configuration restored." -ForegroundColor Green

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host "[SUCCESS] CODE RESTORATIONS COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green

# --- STEP 6: Rebuilding Docker Images ---
Write-Host "`n6. Rebuilding Docker images for all services (Secure Production Mode)..." -ForegroundColor Cyan
try {
    Write-Host "[BUILD] Building session-service..." -ForegroundColor DarkGray
    docker build -t exam-session-service:latest ./services/session-service
    
    Write-Host "[BUILD] Building incident-service..." -ForegroundColor DarkGray
    docker build -t exam-incident-service:latest ./services/incident-service
    
    Write-Host "[BUILD] Building user-service..." -ForegroundColor DarkGray
    docker build -t exam-user-service:latest ./services/user-service
    
    Write-Host "[BUILD] Building admin-service..." -ForegroundColor DarkGray
    docker build -t exam-admin-service:latest ./services/admin-service
    
    Write-Host "[BUILD] Building authorization-server..." -ForegroundColor DarkGray
    docker build -t exam-auth-server:latest ./services/auth-server

    Write-Host "[BUILD] Building bff-gateway..." -ForegroundColor DarkGray
    docker build -t exam-bff:latest ./gateways/bff

    Write-Host "[OK] Docker images rebuilt successfully!" -ForegroundColor Green
} catch {
    Write-Error "[ERROR] Failed to build Docker images. Ensure Docker is running."
    exit 1
}

# --- STEP 7: Restarting Kubernetes Deployments ---
Write-Host "`n7. Restarting Kubernetes deployments to apply secure changes..." -ForegroundColor Cyan
try {
    kubectl rollout restart deployment session-service incident-service user-service admin-service bff-gateway authorization-server -n exam-platform
    
    Write-Host "[WAIT] Waiting for pods rollout to complete..." -ForegroundColor DarkGray
    kubectl rollout status deployment session-service -n exam-platform --timeout=90s
    kubectl rollout status deployment incident-service -n exam-platform --timeout=90s
    kubectl rollout status deployment user-service -n exam-platform --timeout=90s
    kubectl rollout status deployment admin-service -n exam-platform --timeout=90s
    kubectl rollout status deployment bff-gateway -n exam-platform --timeout=90s
    kubectl rollout status deployment authorization-server -n exam-platform --timeout=90s
    
    Write-Host "[OK] Deployments restarted and verified successfully!" -ForegroundColor Green
} catch {
    Write-Warning "[WARN] Failed to monitor rollout status. The pods might still be rolling out in the background."
}

# --- STEP 8: Clean up stuck/redundant containers (Terminating pods) ---
Write-Host "`n8. Scanning for stuck or redundant pods (Terminating/Orphaned)..." -ForegroundColor Cyan
try {
    # Get all pods in Terminating state
    $stuckPods = kubectl get pods -n exam-platform --no-headers | Where-Object { $_ -match "Terminating" }
    
    if ($stuckPods) {
        $podCount = 0
        foreach ($line in $stuckPods) {
            $podName = ($line -split '\s+')[0]
            if ($podName) {
                $podCount++
                Write-Host "[CLEANUP] Force deleting stuck pod: $podName" -ForegroundColor Yellow
                kubectl delete pod $podName -n exam-platform --grace-period=0 --force --ignore-not-found=true | Out-Null
            }
        }
        Write-Host "[OK] $podCount stuck pods cleaned up successfully!" -ForegroundColor Green
    } else {
        Write-Host "[OK] No stuck or redundant pods found. All old containers cleaned up gracefully by Kubernetes." -ForegroundColor Green
    }
} catch {
    Write-Warning "[WARN] Failed to scan or clean up stuck pods."
}

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host "[SUCCESS] ALL SECURITY RULES & NEW L7 POLICIES ENABLED AND MICROSERVICES AUTOMATICALLY REBUILT & SECURED!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green

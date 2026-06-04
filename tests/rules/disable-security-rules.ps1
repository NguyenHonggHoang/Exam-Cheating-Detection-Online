# disable-security-rules.ps1
# Script to disable security filters, Istio authorization policies, Cilium network policies, and JWT token validation
# This allows testing the APIs directly without being blocked by authorization rules.

function Write-Utf8NoBom($path, $content) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
}

Write-Host "======================================================================" -ForegroundColor Yellow
Write-Host "[SECURE] STARTING TO DISABLE SECURITY RULES AND JWT AUTHENTICATION..." -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Yellow

# --- STEP 1: Delete Kubernetes Istio Policies & Cilium Policies ---
Write-Host "`n1. Removing K8s Istio AuthorizationPolicies and CiliumNetworkPolicies..." -ForegroundColor Cyan
try {
    # Disable Istio sidecar auto-injection for the namespace
    kubectl label namespace exam-platform istio-injection=disabled --overwrite
    Write-Host "[OK] Istio auto-injection disabled on namespace exam-platform!" -ForegroundColor Green

    # Delete Istio AuthorizationPolicies (Including new policies)
    kubectl delete authorizationpolicy user-service-policy incident-service-policy session-service-policy authorization-server-policy admin-service-policy bff-gateway-policy -n exam-platform --ignore-not-found=true
    
    # Delete Cilium Network Policies (Including new policies)
    kubectl delete ciliumnetworkpolicy user-service-policy incident-service-policy authorization-server-policy session-service-policy admin-service-policy bff-gateway-policy postgres-policy rabbitmq-policy pgbouncer-policy dedicated-db-policy -n exam-platform --ignore-not-found=true
    
    Write-Host "[OK] Network and Istio policies temporarily deleted successfully!" -ForegroundColor Green
} catch {
    Write-Warning "[WARN] Failed to interact with Kubernetes cluster. Ensure kubectl is configured and connected."
}

# --- STEP 2: Backup and Override SecurityConfig.java for Session Service ---
Write-Host "`n2. Overriding SecurityConfig.java in session-service..." -ForegroundColor Cyan
$sessionPath = "services/session-service/src/main/java/com/example/exam/config/SecurityConfig.java"
if (Test-Path $sessionPath) {
    Copy-Item $sessionPath "$sessionPath.bak" -Force
    $sessionPermitAll = @"
package com.example.exam.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .anyRequest().permitAll())
            .cors(Customizer.withDefaults())
            .csrf(AbstractHttpConfigurer::disable);
        return http.build();
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        return new JwtAuthenticationConverter();
    }
}
"@
    Write-Utf8NoBom $sessionPath $sessionPermitAll
    Write-Host "[OK] session-service configured to Permit All (JWT Auth Disabled)." -ForegroundColor Green
} else {
    Write-Warning "[WARN] File not found: $sessionPath"
}

# --- STEP 3: Backup and Override SecurityConfig.java for Incident Service ---
Write-Host "`n3. Overriding SecurityConfig.java in incident-service..." -ForegroundColor Cyan
$incidentPath = "services/incident-service/src/main/java/com/example/exam/config/SecurityConfig.java"
if (Test-Path $incidentPath) {
    Copy-Item $incidentPath "$incidentPath.bak" -Force
    $incidentPermitAll = @"
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
                .anyRequest().permitAll())
            .cors(Customizer.withDefaults())
            .csrf(AbstractHttpConfigurer::disable);
        return http.build();
    }

    @Bean
    public CustomJwtAuthenticationConverter jwtAuthenticationConverter() {
        return new CustomJwtAuthenticationConverter();
    }
}
"@
    Write-Utf8NoBom $incidentPath $incidentPermitAll
    Write-Host "[OK] incident-service configured to Permit All (JWT Auth Disabled)." -ForegroundColor Green
} else {
    Write-Warning "[WARN] File not found: $incidentPath"
}

# --- STEP 4: Backup and Override SecurityConfig.java for User Service ---
Write-Host "`n4. Overriding SecurityConfig.java in user-service..." -ForegroundColor Cyan
$userPath = "services/user-service/src/main/java/com/examplatform/identity/config/SecurityConfig.java"
if (Test-Path $userPath) {
    Copy-Item $userPath "$userPath.bak" -Force
    $userPermitAll = @"
package com.examplatform.identity.config;

import com.examplatform.identity.security.CustomJwtAuthenticationConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(authorize -> authorize
                        .anyRequest().permitAll());
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
"@
    Write-Utf8NoBom $userPath $userPermitAll
    Write-Host "[OK] user-service configured to Permit All (JWT Auth Disabled)." -ForegroundColor Green
} else {
    Write-Warning "[WARN] File not found: $userPath"
}

# --- STEP 5: Backup and Override SecurityConfig.java for Admin Service ---
Write-Host "`n5. Overriding SecurityConfig.java in admin-service..." -ForegroundColor Cyan
$adminPath = "services/admin-service/src/main/java/com/examplatform/admin/config/SecurityConfig.java"
if (Test-Path $adminPath) {
    Copy-Item $adminPath "$adminPath.bak" -Force
    $adminPermitAll = @"
package com.examplatform.admin.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;

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
                        .anyRequest().permitAll()
                )
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
        return http.build();
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        return new JwtAuthenticationConverter();
    }
}
"@
    Write-Utf8NoBom $adminPath $adminPermitAll
    Write-Host "[OK] admin-service configured to Permit All (JWT Auth Disabled)." -ForegroundColor Green
} else {
    Write-Warning "[WARN] File not found: $adminPath"
}

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host "[SUCCESS] CODE MODIFICATIONS FOR PERMIT_ALL COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green

# --- STEP 6: Rebuilding Docker Images ---
Write-Host "`n6. Rebuilding Docker images for all services (JWT Auth Disabled)..." -ForegroundColor Cyan
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
Write-Host "`n7. Restarting Kubernetes deployments to apply changes..." -ForegroundColor Cyan
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
Write-Host "[SUCCESS] ALL SECURITY RULES DISABLED AND MICROSERVICES AUTOMATICALLY REBUILT & ROLLOUT!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green

package com.example.exam.security;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;

public class CustomJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        Collection<GrantedAuthority> authorities = new ArrayList<>();

        // 1. Extract Scopes (mặc định claim "scope" hoặc "scp")
        if (jwt.hasClaim("scope")) {
            Object scopes = jwt.getClaim("scope");
            authorities.addAll(extractAuthorities(scopes, "SCOPE_"));
        } else if (jwt.hasClaim("scp")) {
            Object scopes = jwt.getClaim("scp");
            authorities.addAll(extractAuthorities(scopes, "SCOPE_"));
        }

        // 2. Extract Roles (gắn tiền tố "ROLE_")
        if (jwt.hasClaim("roles")) {
            Object roles = jwt.getClaim("roles");
            authorities.addAll(extractAuthorities(roles, "ROLE_"));
        }

        // 3. Extract Permissions (giữ dạng trần không tiền tố)
        if (jwt.hasClaim("permissions")) {
            Object permissions = jwt.getClaim("permissions");
            authorities.addAll(extractAuthorities(permissions, ""));
        }

        // 4. Fallback to authorities claim if present
        if (jwt.hasClaim("authorities")) {
            Object auths = jwt.getClaim("authorities");
            authorities.addAll(extractAuthorities(auths, ""));
        }

        return new JwtAuthenticationToken(jwt, authorities);
    }

    private Collection<GrantedAuthority> extractAuthorities(Object claimValue, String prefix) {
        Collection<GrantedAuthority> authorities = new ArrayList<>();
        if (claimValue instanceof Collection) {
            ((Collection<?>) claimValue).forEach(val -> {
                String authStr = val.toString();
                if (!authStr.isBlank()) {
                    String finalAuth;
                    if (prefix.isEmpty()) {
                        finalAuth = authStr;
                    } else {
                        finalAuth = authStr.startsWith(prefix) ? authStr : prefix + authStr;
                    }
                    authorities.add(new SimpleGrantedAuthority(finalAuth));
                }
            });
        } else if (claimValue instanceof String) {
            Arrays.stream(((String) claimValue).split(" "))
                    .filter(val -> !val.isBlank())
                    .forEach(val -> {
                        String finalAuth;
                        if (prefix.isEmpty()) {
                            finalAuth = val;
                        } else {
                            finalAuth = val.startsWith(prefix) ? val : prefix + val;
                        }
                        authorities.add(new SimpleGrantedAuthority(finalAuth));
                    });
        }
        return authorities;
    }
}

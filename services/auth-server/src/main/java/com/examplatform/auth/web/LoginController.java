package com.examplatform.auth.web;

import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.security.Principal;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

@Controller
public class LoginController {

    @GetMapping("/login")
    public String login() {
        return "login";
    }

    @GetMapping("/oauth2/consent")
    public String consent(Principal principal, Model model,
                          @RequestParam(OAuth2ParameterNames.CLIENT_ID) String clientId,
                          @RequestParam(OAuth2ParameterNames.SCOPE) String scope,
                          @RequestParam(OAuth2ParameterNames.STATE) String state) {

        Set<String> scopesToApprove = new HashSet<>();
        if (scope != null) {
            Collections.addAll(scopesToApprove, scope.split(" "));
        }

        model.addAttribute("clientId", clientId);
        model.addAttribute("state", state);
        model.addAttribute("scopes", withDescription(scopesToApprove));
        model.addAttribute("principalName", principal.getName());

        return "consent";
    }

    private Set<ScopeWithDescription> withDescription(Set<String> scopes) {
        Set<ScopeWithDescription> scopeWithDescriptions = new HashSet<>();
        for (String scope : scopes) {
            scopeWithDescriptions.add(new ScopeWithDescription(scope));
        }
        return scopeWithDescriptions;
    }

    public static class ScopeWithDescription {
        public final String scope;
        public final String description;

        public ScopeWithDescription(String scope) {
            this.scope = scope;
            this.description = getDescriptionForScope(scope);
        }

        private String getDescriptionForScope(String scope) {
            switch (scope) {
                case "openid":
                    return "View your personal information, including your name and email address.";
                case "profile":
                    return "View your basic profile information.";
                case "email":
                    return "View your email address.";
                case "offline_access":
                    return "Access your data even when you are not currently using the app.";
                default:
                    return "Access your data for: " + scope;
            }
        }
    }
}

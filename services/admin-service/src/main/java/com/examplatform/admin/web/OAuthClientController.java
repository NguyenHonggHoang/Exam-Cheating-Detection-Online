package com.examplatform.admin.web;

import com.examplatform.admin.service.OAuthClientService;
import com.examplatform.admin.web.dto.OAuthClientCreateRequest;
import com.examplatform.admin.web.dto.OAuthClientResponse;
import com.examplatform.admin.web.dto.OAuthClientUpdateRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/clients")
public class OAuthClientController {

    private final OAuthClientService clientService;

    public OAuthClientController(OAuthClientService clientService) {
        this.clientService = clientService;
    }

    @GetMapping
    public List<OAuthClientResponse> listClients() {
        return clientService.findAll();
    }

    @GetMapping("/{clientId}")
    public OAuthClientResponse getClient(@PathVariable String clientId) {
        return clientService.findByClientId(clientId);
    }

    @PostMapping
    public ResponseEntity<OAuthClientResponse> createClient(@Valid @RequestBody OAuthClientCreateRequest request) {
        var response = clientService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{clientId}")
    public OAuthClientResponse updateClient(@PathVariable String clientId,
                                            @Valid @RequestBody OAuthClientUpdateRequest request) {
        return clientService.update(clientId, request);
    }

    @DeleteMapping("/{clientId}")
    public ResponseEntity<Void> deleteClient(@PathVariable String clientId) {
        clientService.delete(clientId);
        return ResponseEntity.noContent().build();
    }
}


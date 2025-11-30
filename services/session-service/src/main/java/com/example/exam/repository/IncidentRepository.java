package com.example.exam.repository;

import com.example.exam.model.Incident;
import com.example.exam.model.IncidentStatus;
import com.example.exam.model.IncidentType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IncidentRepository extends JpaRepository<Incident, UUID> {
    List<Incident> findBySessionIdOrderByTsAsc(UUID sessionId);
    List<Incident> findByTypeAndStatus(IncidentType type, IncidentStatus status);
    Page<Incident> findBySessionId(UUID sessionId, Pageable pageable);
    Optional<Incident> findBySessionIdAndTypeAndTs(UUID sessionId, IncidentType type, Long ts);
}

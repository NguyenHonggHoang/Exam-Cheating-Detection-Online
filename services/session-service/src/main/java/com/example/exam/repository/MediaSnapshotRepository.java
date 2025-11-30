package com.example.exam.repository;

import com.example.exam.model.MediaSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MediaSnapshotRepository extends JpaRepository<MediaSnapshot, UUID> {
    Optional<MediaSnapshot> findByIdempotencyKey(String idempotencyKey);
    List<MediaSnapshot> findBySessionIdOrderByTsAsc(UUID sessionId);
}

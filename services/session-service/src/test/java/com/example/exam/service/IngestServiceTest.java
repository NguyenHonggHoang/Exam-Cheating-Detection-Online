package com.example.exam.service;

import com.example.exam.dto.EventIngestDto;
import com.example.exam.dto.SnapshotIngestDto;
import com.example.exam.model.Event;
import com.example.exam.model.EventType;
import com.example.exam.model.MediaSnapshot;
import com.example.exam.repository.EventRepository;
import com.example.exam.repository.MediaSnapshotRepository;
import com.example.exam.repository.SessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IngestServiceTest {

    @Mock
    SessionRepository sessionRepository;
    @Mock
    EventRepository eventRepository;
    @Mock
    MediaSnapshotRepository snapshotRepository;

    @InjectMocks
    IngestService ingestService;

    UUID sessionId;

    @BeforeEach
    void setUp() {
        sessionId = UUID.randomUUID();
    }

    @Test
    void ingestEvents_happyPath_createsAll_noDuplicates() {
        // Arrange
        when(sessionRepository.existsById(sessionId)).thenReturn(true);
        when(eventRepository.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        // save returns the same entity (ID is pre-generated in constructor)
        when(eventRepository.save(any(Event.class))).thenAnswer(inv -> inv.getArgument(0));

        var item1 = new EventIngestDto.Item();
        item1.sessionId = sessionId;
        item1.ts = 100L;
        item1.eventType = EventType.TAB_SWITCH;
        item1.details = "{}";
        item1.idempotencyKey = "k1";

        var item2 = new EventIngestDto.Item();
        item2.sessionId = sessionId;
        item2.ts = 200L;
        item2.eventType = EventType.FOCUS;
        item2.details = null;
        item2.idempotencyKey = "k2";

        var req = new EventIngestDto.Request();
        req.items = List.of(item1, item2);

        // Act
        var result = ingestService.ingestEvents(req);

        // Assert
        assertThat(result.created).isEqualTo(2);
        assertThat(result.duplicates).isZero();
        assertThat(result.ids).hasSize(2);

        ArgumentCaptor<Event> captor = ArgumentCaptor.forClass(Event.class);
        verify(eventRepository, times(2)).save(captor.capture());
        var saved = captor.getAllValues();
        assertThat(saved.get(0).getCreatedAt()).isNotNull();
        assertThat(saved.get(1).getCreatedAt()).isNotNull();
    }

    @Test
    void ingestEvents_duplicateSuppressed_countsDuplicateAndReturnsExistingId() {
        // Arrange
        when(sessionRepository.existsById(sessionId)).thenReturn(true);

        var existing = new Event();
        existing.setSessionId(sessionId);
        existing.setTs(100L);
        existing.setEventType(EventType.TAB_SWITCH);
        existing.setIdempotencyKey("dup-key");
        existing.setCreatedAt(Instant.now());

        when(eventRepository.findByIdempotencyKey("dup-key")).thenReturn(Optional.of(existing));
        when(eventRepository.findByIdempotencyKey("new-key")).thenReturn(Optional.empty());
        when(eventRepository.save(any(Event.class))).thenAnswer(inv -> inv.getArgument(0));

        var dup = new EventIngestDto.Item();
        dup.sessionId = sessionId;
        dup.ts = 100L;
        dup.eventType = EventType.TAB_SWITCH;
        dup.details = null;
        dup.idempotencyKey = "dup-key";

        var fresh = new EventIngestDto.Item();
        fresh.sessionId = sessionId;
        fresh.ts = 101L;
        fresh.eventType = EventType.BLUR;
        fresh.details = null;
        fresh.idempotencyKey = "new-key";

        var req = new EventIngestDto.Request();
        req.items = List.of(dup, fresh);

        // Act
        var result = ingestService.ingestEvents(req);

        // Assert
        assertThat(result.created).isEqualTo(1);
        assertThat(result.duplicates).isEqualTo(1);
        assertThat(result.ids).hasSize(2);
        assertThat(result.ids).contains(existing.getId());

        verify(eventRepository, times(1)).save(any(Event.class));
    }

    @Test
    void ingestEvents_missingSession_skipsItem() {
        // Arrange
        when(sessionRepository.existsById(sessionId)).thenReturn(false);

        var item = new EventIngestDto.Item();
        item.sessionId = sessionId;
        item.ts = 100L;
        item.eventType = EventType.PASTE;
        item.details = null;
        item.idempotencyKey = "k1";

        var req = new EventIngestDto.Request();
        req.items = List.of(item);

        // Act
        var result = ingestService.ingestEvents(req);

        // Assert
        assertThat(result.created).isZero();
        assertThat(result.duplicates).isZero();
        assertThat(result.ids).isEmpty();
        verify(eventRepository, never()).save(any());
    }

    @Test
    void ingestSnapshots_happyPath_createsAll_noDuplicates() {
        // Arrange
        when(sessionRepository.existsById(sessionId)).thenReturn(true);
        when(snapshotRepository.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(snapshotRepository.save(any(MediaSnapshot.class))).thenAnswer(inv -> inv.getArgument(0));

        var s1 = new SnapshotIngestDto.Item();
        s1.sessionId = sessionId;
        s1.ts = 123L;
        s1.objectKey = "obj-1";
        s1.fileSize = 10L;
        s1.mimeType = "image/jpeg";
        s1.faceCount = 1;
        s1.idempotencyKey = "k1";

        var s2 = new SnapshotIngestDto.Item();
        s2.sessionId = sessionId;
        s2.ts = 124L;
        s2.objectKey = "obj-2";
        s2.fileSize = 11L;
        s2.mimeType = "image/png";
        s2.faceCount = 0;
        s2.idempotencyKey = "k2";

        var req = new SnapshotIngestDto.Request();
        req.items = List.of(s1, s2);

        // Act
        var result = ingestService.ingestSnapshots(req);

        // Assert
        assertThat(result.created).isEqualTo(2);
        assertThat(result.duplicates).isZero();
        assertThat(result.ids).hasSize(2);

        ArgumentCaptor<MediaSnapshot> captor = ArgumentCaptor.forClass(MediaSnapshot.class);
        verify(snapshotRepository, times(2)).save(captor.capture());
        var saved = captor.getAllValues();
        assertThat(saved.get(0).getUploadedAt()).isNotNull();
        assertThat(saved.get(1).getUploadedAt()).isNotNull();
    }

    @Test
    void ingestSnapshots_duplicateSuppressed_countsDuplicateAndReturnsExistingId() {
        // Arrange
        when(sessionRepository.existsById(sessionId)).thenReturn(true);

        var existing = new MediaSnapshot();
        existing.setSessionId(sessionId);
        existing.setTs(123L);
        existing.setObjectKey("obj-1");
        existing.setUploadedAt(Instant.now());
        existing.setIdempotencyKey("dup-key");

        when(snapshotRepository.findByIdempotencyKey("dup-key")).thenReturn(Optional.of(existing));
        when(snapshotRepository.findByIdempotencyKey("new-key")).thenReturn(Optional.empty());
        when(snapshotRepository.save(any(MediaSnapshot.class))).thenAnswer(inv -> inv.getArgument(0));

        var dup = new SnapshotIngestDto.Item();
        dup.sessionId = sessionId;
        dup.ts = 123L;
        dup.objectKey = "obj-1";
        dup.idempotencyKey = "dup-key";

        var fresh = new SnapshotIngestDto.Item();
        fresh.sessionId = sessionId;
        fresh.ts = 124L;
        fresh.objectKey = "obj-2";
        fresh.idempotencyKey = "new-key";

        var req = new SnapshotIngestDto.Request();
        req.items = List.of(dup, fresh);

        // Act
        var result = ingestService.ingestSnapshots(req);

        // Assert
        assertThat(result.created).isEqualTo(1);
        assertThat(result.duplicates).isEqualTo(1);
        assertThat(result.ids).hasSize(2);
        assertThat(result.ids).contains(existing.getId());
        verify(snapshotRepository, times(1)).save(any(MediaSnapshot.class));
    }

    @Test
    void ingestSnapshots_missingSession_skipsItem() {
        // Arrange
        when(sessionRepository.existsById(sessionId)).thenReturn(false);

        var item = new SnapshotIngestDto.Item();
        item.sessionId = sessionId;
        item.ts = 123L;
        item.objectKey = "obj-1";
        item.idempotencyKey = "k1";

        var req = new SnapshotIngestDto.Request();
        req.items = List.of(item);

        // Act
        var result = ingestService.ingestSnapshots(req);

        // Assert
        assertThat(result.created).isZero();
        assertThat(result.duplicates).isZero();
        assertThat(result.ids).isEmpty();
        verify(snapshotRepository, never()).save(any());
    }
}

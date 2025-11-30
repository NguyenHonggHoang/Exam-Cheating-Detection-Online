package com.example.exam.dto;

import java.util.UUID;

/**
 * Message sent to RabbitMQ queue when snapshot is uploaded
 * Worker will process this to detect faces and create incidents
 * 
 * @param snapshotId ID of the media_snapshots record
 * @param sessionId Session that uploaded the snapshot
 * @param objectKey File path/key in storage
 * @param timestamp Unix timestamp (milliseconds) of the snapshot
 */
public record SnapshotMessage(
    UUID snapshotId,
    UUID sessionId,
    String objectKey,
    Long timestamp
) {}

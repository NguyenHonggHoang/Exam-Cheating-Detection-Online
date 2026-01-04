---
trigger: model_decision
globs: use for incident service
---

1) MỤC LƯỢC (What the rule covers)

Nhận message từ Message Broker (routing key: violation_events).

Validate schema & signature của message.

Idempotency / deduplication.

Verify proof image URL (S3) — quyền truy cập / signed URL.

Transactional persist vào DB (incident table).

Emit audit log + notification + metrics.

Retry / DLQ policy.

Security checks (token/JWKS if needed for service-to-service calls).

Observability & alerts.

2) MESSAGE CONTRACT (BẮT BUỘC)

Routing key: violation_events
Queue: incident_service_queue
Message (JSON):

{
  "event_id": "uuid-v4",            // BẮT BUỘC: unique id per detection event
  "student_id": "string",
  "violation": "string",            // e.g., "looking-away", "phone-detected"
  "score": 0.92,                    // optional: model confidence (0..1)
  "timestamp": 1700452031000,       // epoch ms UTC
  "proof_image_url": "string",      // S3/MinIO URL (signed or CDN)
  "source": "media-server-id",      // optional: origin id
  "model_version": "v1.2.3"         // optional: for traceability
}


Validation rules:

event_id, student_id, violation, timestamp, proof_image_url phải tồn tại.

timestamp không được ở tương lai > 5 phút so với server time (tolerate clock skew).

score (nếu có) nằm trong [0,1].

proof_image_url phải là HTTPS và host thuộc allowlist (S3/MinIO/CDN).

3) PROCESSING PIPELINE (IF / THEN style) — Agent logic
A. OnMessage Received

Parse JSON.

Validate schema.

IF invalid → NACK or move to schema_error_queue with metadata and original message. Log error.

Check deduplication by event_id.

IF event_id seen before → ACK and log [INFO] duplicate event_id (idempotent).

Verify proof_image_url accessibility:

IF URL is signed URL: perform HEAD request and check 200 & content-type image/* within short timeout (e.g., 3s).

IF inaccessible → schedule retry up to N times, else move to dlq_image_unavailable.

Persist into DB in a transaction (see DB schema).

Publish Audit event / Notification (webhook / internal topic).

Emit metrics: incidents.processed, incidents.failed, incidents.duplicate.

ACK message.

B. Error Handling & Retry

Transient errors (network, temp DB lock, S3 timeout): retry with exponential backoff: 1s, 2s, 4s, 8s (max 5 retries).

Permanent errors (validation failure, missing required fields): route to dead_letter_queue with reason.

Implement per-message retry count in headers (or use broker retry/exchange patterns).

After max retries → push to incident_service_dlq and create a high-priority alert.

C. Idempotency & Dedup

Maintain table processed_events(event_id PK, received_at) or Redis set with TTL (e.g., 30 days).

Use DB unique constraint to protect against race conditions (insert if not exists).

If duplicate during insert → treat as already processed.

4) DATABASE DESIGN (minimal)

Table: incidents

CREATE TABLE incidents (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE,
  student_id VARCHAR(128) NOT NULL,
  violation VARCHAR(128) NOT NULL,
  score NUMERIC(5,4),
  timestamp_ms BIGINT NOT NULL,
  proof_image_url TEXT NOT NULL,
  model_version VARCHAR(64),
  source VARCHAR(128),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


Table: processed_events (optional)

CREATE TABLE processed_events (
  event_id UUID PRIMARY KEY,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

5) SECURITY CHECKS

Only internal broker: Ensure broker accessible only inside VPC / internal network.

Proof URL allowlist: Only accept proof_image_url from configured buckets/domains. Reject external hosts.

Message authenticity (optional but recommended):

Python Model can sign message HMAC using a shared secret; Incident Service verifies HMAC header X-Event-Signature.

OR attach signature and public_key_id to verify using asymmetric signature (recommended for high security).

Service-to-service auth: When Incident Service calls other internal APIs, use mTLS or OAuth2 client credentials. Do not use client-side tokens.

6) LOGGING & FORMAT (follow global rules)

Use the standardized logging format for Spring Boot:

log.error("[Service: IncidentService] Action: processEvent Failed. Reason: {}", ex.getMessage());
log.info("[Service: IncidentService] Action: processEvent Success. EventId: {}", eventId);


Include structured logs (JSON) with fields: event_id, student_id, violation, model_version, status.

For BFF or Node:

console.error("[BFF][/api/webrtc] Error:", error.message, error.response?.data);

7) MONITORING & ALERTS

Metrics: incidents.processed_total, incidents.failed_total, incidents.duplicate_total, incidents.processing_latency_ms.

Alert rules:

If incidents.failed_total / minute > threshold → PagerDuty.

If dlq rate increases → investigate model pipeline.

If image verification failures > X% → alert (possible S3 permission regression).

8) EXAMPLE Spring Boot Consumer (pseudocode)
@Component
public class IncidentConsumer {

  @Autowired IncidentRepository repo;
  @Autowired ImageVerifier imageVerifier;

  @RabbitListener(queues = "incident_service_queue")
  public void handle(Message msg) {
    String body = new String(msg.getBody(), StandardCharsets.UTF_8);
    try {
      JsonNode event = objectMapper.readTree(body);
      String eventId = event.get("event_id").asText();

      if (processedEventExists(eventId)) {
        log.info("[Service: IncidentService] Action: processEvent Duplicate. EventId: {}", eventId);
        // ack
        return;
      }

      validateSchema(event); // throw BadRequest exception if invalid

      String url = event.get("proof_image_url").asText();
      if (!imageVerifier.isAccessible(url)) {
        throw new TemporaryException("Image not accessible");
      }

      // transactional persist
      incidentRepository.save(mapToIncident(event));

      publishAudit(event);
      metrics.increment("incidents.processed");
    } catch (TemporaryException te) {
      // requeue or use broker requeue mechanism
      throw te; // allow broker to retry
    } catch (Exception ex) {
      log.error("[Service: IncidentService] Action: processEvent Failed. Reason: {}", ex.getMessage());
      // send to DLQ with metadata
    }
  }
}

9) TEST CASES (agent should auto-generate to validate pipeline)

Valid message with accessible signed URL → persisted as incident.

Duplicate event_id → no double insert, ack message.

Invalid schema (missing event_id) → move to dlq_schema_errors.

Inaccessible proof URL → retry N times then DLQ dlq_image_unavailable.

Malicious URL (external host) → reject and alert security.

HMAC signature mismatch → reject and record security incident.
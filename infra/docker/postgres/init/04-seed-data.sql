-- 04-seed-data.sql
-- Seed data for session_db (exams, sessions, events)
-- NOTE: User data comes from identity_db via CDC sync to user_shadow
-- This file is loaded during Docker initialization

-- Connect to session_db
\connect session_db

-- 0) Ensure pgcrypto available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- 1) Seed user_shadow with sample data (simulating CDC sync)
-- In production, this data comes from identity_db via Kafka CDC
-- Using same IDs as identity_db for consistency
-- =============================================
INSERT INTO user_shadow (user_id, username, email, role, enabled, deleted, synced_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'admin', 'admin@example.com', 'ADMIN', true, false, now())
ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username, email = EXCLUDED.email;

INSERT INTO user_shadow (user_id, username, email, role, enabled, deleted, synced_at)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002', 'reviewer', 'reviewer@example.com', 'REVIEWER', true, false, now())
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_shadow (user_id, username, email, role, enabled, deleted, synced_at)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-000000000003', 'proctor', 'proctor@example.com', 'PROCTOR', true, false, now())
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_shadow (user_id, username, email, role, enabled, deleted, synced_at)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-000000000004', 'student', 'student@example.com', 'CANDIDATE', true, false, now())
ON CONFLICT (user_id) DO NOTHING;

-- =============================================
-- 2) Create a sample exam (use admin's user_id from identity_db)
-- =============================================
INSERT INTO exams (id, name, description, start_time, end_time, retention_days, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000100'::uuid,
  'Kỳ thi mẫu',
  'Exam demo seed',
  now() - interval '30 minutes',
  now() + interval '2 hours',
  30,
  'aaaaaaaa-aaaa-aaaa-aaaa-000000000001'  -- admin user_id from identity_db
)
ON CONFLICT DO NOTHING;

-- =============================================
-- 3) Create a session for student
-- Note: user_id references user_shadow.user_id (from identity_db)
-- =============================================
INSERT INTO sessions (id, user_id, exam_id, started_at, status, ip_address, user_agent)
VALUES (
  '00000000-0000-0000-0000-000000000200'::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-000000000004',  -- student user_id from identity_db
  '00000000-0000-0000-0000-000000000100'::uuid,
  now() - interval '10 minutes',
  'ACTIVE',
  '127.0.0.1',
  'Chrome/Windows'
)
ON CONFLICT DO NOTHING;

-- =============================================
-- 4) Insert telemetry events for the session
-- =============================================
INSERT INTO events (id, session_id, ts, event_type, details, idempotency_key)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000200'::uuid,
  (EXTRACT(EPOCH FROM NOW())*1000)::bigint,
  'TAB_SWITCH',
  '{"count":1}'::jsonb,
  'seed-tab-switch-001'
)
ON CONFLICT (idempotency_key) DO NOTHING;

INSERT INTO events (id, session_id, ts, event_type, details, idempotency_key)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000200'::uuid,
  (EXTRACT(EPOCH FROM NOW())*1000)::bigint + 1000,
  'PASTE',
  '{"field":"answer1"}'::jsonb,
  'seed-paste-001'
)
ON CONFLICT (idempotency_key) DO NOTHING;

-- =============================================
-- 5) Insert sample media_snapshot (webcam image metadata)
-- =============================================
INSERT INTO media_snapshots (id, session_id, ts, object_key, file_size, mime_type, uploaded_at, face_count, idempotency_key)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000200'::uuid,
  (EXTRACT(EPOCH FROM NOW())*1000)::bigint,
  'samples/00000000-0000-0000-0000-000000000200/img-1.jpg',
  12345,
  'image/jpeg',
  now(),
  1,
  'seed-snapshot-001'
)
ON CONFLICT (idempotency_key) DO NOTHING;

-- Note: Incident seed data has been moved to 06-incident-seed-data.sql

-- =============================================
-- 6) Verification queries
-- =============================================
SELECT '=== User Shadow (from identity_db via CDC) ===' AS section;
SELECT user_id, username, role, deleted FROM user_shadow ORDER BY username;

SELECT '=== Exams ===' AS section;
SELECT id, name, created_by FROM exams;

SELECT '=== Sessions ===' AS section;
SELECT s.id, s.user_id, u.username, s.exam_id, s.status 
FROM sessions s 
LEFT JOIN user_shadow u ON s.user_id = u.user_id;

SELECT '=== Events ===' AS section;
SELECT id, session_id, event_type, idempotency_key FROM events;

SELECT '=== Media Snapshots ===' AS section;
SELECT id, session_id, object_key, face_count FROM media_snapshots;

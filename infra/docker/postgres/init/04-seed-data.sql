-- 04-seed-data.sql
-- Seed data for session_db (users, exams, sessions, events, incidents)
-- This file is loaded during Docker initialization

-- Connect to session_db
\connect session_db

-- 0) Ensure pgcrypto available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Insert sample users (do nothing if username already exists)
INSERT INTO users (id, username, email, password_hash, role)
VALUES
  (gen_random_uuid(), 'admin',    'admin@example.com',    '{noop}admin',    'ADMIN')
ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email
RETURNING id, username
;

INSERT INTO users (id, username, email, password_hash, role)
VALUES (gen_random_uuid(), 'reviewer', 'reviewer@example.com', '{noop}reviewer', 'REVIEWER')
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (id, username, email, password_hash, role)
VALUES (gen_random_uuid(), 'proctor', 'proctor@example.com', '{noop}proctor', 'PROCTOR')
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (id, username, email, password_hash, role)
VALUES (gen_random_uuid(), 'student', 'student@example.com', '{noop}student', 'CANDIDATE')
ON CONFLICT (username) DO NOTHING;

-- 2) Create a sample exam if not exists (identified by name)
WITH admin_u AS (
  SELECT id AS admin_id FROM users WHERE username = 'admin' LIMIT 1
)
INSERT INTO exams (id, name, description, start_time, end_time, retention_days, created_by)
SELECT gen_random_uuid(), 'Kỳ thi mẫu', 'Exam demo seed', now() - interval '30 minutes', now() + interval '2 hours', 30, admin_id
FROM admin_u
WHERE NOT EXISTS (SELECT 1 FROM exams WHERE name = 'Kỳ thi mẫu');

-- 3) Create a session for student for the latest "Kỳ thi mẫu" if none recent
WITH s AS (
  SELECT u.id AS user_id, e.id AS exam_id
  FROM users u, exams e
  WHERE u.username = 'student' AND e.name = 'Kỳ thi mẫu'
  LIMIT 1
)
INSERT INTO sessions (id, user_id, exam_id, started_at, status, ip_address, user_agent)
SELECT gen_random_uuid(), s.user_id, s.exam_id, now() - interval '10 minutes', 'ACTIVE', '127.0.0.1', 'Chrome/Windows'
FROM s
WHERE NOT EXISTS (
  SELECT 1 FROM sessions ss
  WHERE ss.user_id = s.user_id AND ss.exam_id = s.exam_id AND ss.started_at > now() - interval '1 day'
)
RETURNING id;

-- 4) Insert telemetry events for the latest session (tab switch, paste)
WITH latest_session AS (
  SELECT id AS session_id FROM sessions ORDER BY started_at DESC LIMIT 1
)
INSERT INTO events (id, session_id, ts, event_type, details, idempotency_key)
SELECT gen_random_uuid(),
       ls.session_id,
       (EXTRACT(EPOCH FROM NOW())*1000)::bigint,
       'TAB_SWITCH',
       '{"count":1}'::jsonb,
       gen_random_uuid()::text
FROM latest_session ls
-- avoid inserting the same event repeatedly in a short window
WHERE NOT EXISTS (
  SELECT 1 FROM events e
  WHERE e.session_id = ls.session_id AND e.event_type = 'TAB_SWITCH' AND e.created_at > now() - interval '5 minutes'
);

WITH latest_session AS (
  SELECT id AS session_id FROM sessions ORDER BY started_at DESC LIMIT 1
)
INSERT INTO events (id, session_id, ts, event_type, details, idempotency_key)
SELECT gen_random_uuid(),
       ls.session_id,
       (EXTRACT(EPOCH FROM NOW())*1000)::bigint,
       'PASTE',
       '{"field":"answer1"}'::jsonb,
       gen_random_uuid()::text
FROM latest_session ls
WHERE NOT EXISTS (
  SELECT 1 FROM events e
  WHERE e.session_id = ls.session_id AND e.event_type = 'PASTE' AND e.created_at > now() - interval '5 minutes'
);

-- 5) Insert sample media_snapshot (webcam image metadata) for latest session
WITH latest_session AS (
  SELECT id AS session_id FROM sessions ORDER BY started_at DESC LIMIT 1
)
INSERT INTO media_snapshots (id, session_id, ts, object_key, file_size, mime_type, uploaded_at, face_count, idempotency_key)
SELECT gen_random_uuid(),
       ls.session_id,
       (EXTRACT(EPOCH FROM NOW())*1000)::bigint,
       concat('samples/', ls.session_id::text, '/img-1.jpg')::text,
       12345,
       'image/jpeg',
       now(),
       1,
       gen_random_uuid()::text
FROM latest_session ls
WHERE NOT EXISTS (
  SELECT 1 FROM media_snapshots m WHERE m.session_id = ls.session_id AND m.object_key LIKE concat('samples/', ls.session_id::text, '/img-1.jpg')
);

-- 6) Insert two incidents (OPEN) for that session if not exists (TAB_ABUSE and PASTE)
WITH latest_session AS (
  SELECT id AS session_id FROM sessions ORDER BY started_at DESC LIMIT 1
)
INSERT INTO incidents (id, session_id, ts, type, score, reason, evidence_url, status)
SELECT gen_random_uuid(),
       ls.session_id,
       (EXTRACT(EPOCH FROM NOW())*1000)::bigint,
       'TAB_ABUSE',
       0.50,
       'Tab abuse demo',
       concat('samples/', ls.session_id::text, '/img-1.jpg'),
       'OPEN'
FROM latest_session ls
WHERE NOT EXISTS (
  SELECT 1 FROM incidents i WHERE i.session_id = ls.session_id AND i.type = 'TAB_ABUSE' AND i.created_at > now() - interval '1 day'
);

WITH latest_session AS (
  SELECT id AS session_id FROM sessions ORDER BY started_at DESC LIMIT 1
)
INSERT INTO incidents (id, session_id, ts, type, score, reason, evidence_url, status)
SELECT gen_random_uuid(),
       ls.session_id,
       (EXTRACT(EPOCH FROM NOW())*1000)::bigint,
       'PASTE',
       0.40,
       'Paste demo',
       concat('samples/', ls.session_id::text, '/img-1.jpg'),
       'OPEN'
FROM latest_session ls
WHERE NOT EXISTS (
  SELECT 1 FROM incidents i WHERE i.session_id = ls.session_id AND i.type = 'PASTE' AND i.created_at > now() - interval '1 day'
);

-- 7) Optionally create a review by 'reviewer' for one incident (mark CONFIRMED) once
WITH r AS (SELECT id FROM users WHERE username = 'reviewer' LIMIT 1),
     incident_to_review AS (
       SELECT id FROM incidents WHERE type = 'TAB_ABUSE' ORDER BY created_at DESC LIMIT 1
     )
INSERT INTO reviews (id, incident_id, reviewer_id, status, note)
SELECT gen_random_uuid(), ir.id, r.id, 'CONFIRMED', 'Sample confirm by reviewer'
FROM incident_to_review ir, r
ON CONFLICT (incident_id) DO NOTHING;

-- 8) Short verification selects (for convenience)
SELECT count(*) AS users_cnt FROM users;
-- 04-seed-data.sql
-- Seed data for session_db (users, exams, sessions, events, incidents)
-- This file is loaded during Docker initialization

-- Connect to session_db
\connect session_db

-- 0) Ensure pgcrypto available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Insert sample users (do nothing if username already exists)
INSERT INTO users (id, username, email, password_hash, role)
VALUES
  (gen_random_uuid(), 'admin',    'admin@example.com',    '{noop}admin',    'ADMIN')
ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email
RETURNING id, username
;

INSERT INTO users (id, username, email, password_hash, role)
VALUES (gen_random_uuid(), 'reviewer', 'reviewer@example.com', '{noop}reviewer', 'REVIEWER')
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (id, username, email, password_hash, role)
VALUES (gen_random_uuid(), 'proctor', 'proctor@example.com', '{noop}proctor', 'PROCTOR')
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (id, username, email, password_hash, role)
VALUES (gen_random_uuid(), 'student', 'student@example.com', '{noop}student', 'CANDIDATE')
ON CONFLICT (username) DO NOTHING;

-- 2) Create a sample exam if not exists (identified by name)
WITH admin_u AS (
  SELECT id AS admin_id FROM users WHERE username = 'admin' LIMIT 1
)
INSERT INTO exams (id, name, description, start_time, end_time, retention_days, created_by)
SELECT gen_random_uuid(), 'Kỳ thi mẫu', 'Exam demo seed', now() - interval '30 minutes', now() + interval '2 hours', 30, admin_id
FROM admin_u
WHERE NOT EXISTS (SELECT 1 FROM exams WHERE name = 'Kỳ thi mẫu');

-- 3) Create a session for student for the latest "Kỳ thi mẫu" if none recent
WITH s AS (
  SELECT u.id AS user_id, e.id AS exam_id
  FROM users u, exams e
  WHERE u.username = 'student' AND e.name = 'Kỳ thi mẫu'
  LIMIT 1
)
INSERT INTO sessions (id, user_id, exam_id, started_at, status, ip_address, user_agent)
SELECT gen_random_uuid(), s.user_id, s.exam_id, now() - interval '10 minutes', 'ACTIVE', '127.0.0.1', 'Chrome/Windows'
FROM s
WHERE NOT EXISTS (
  SELECT 1 FROM sessions ss
  WHERE ss.user_id = s.user_id AND ss.exam_id = s.exam_id AND ss.started_at > now() - interval '1 day'
)
RETURNING id;

-- 4) Insert telemetry events for the latest session (tab switch, paste)
WITH latest_session AS (
  SELECT id AS session_id FROM sessions ORDER BY started_at DESC LIMIT 1
)
INSERT INTO events (id, session_id, ts, event_type, details, idempotency_key)
SELECT gen_random_uuid(),
       ls.session_id,
       (EXTRACT(EPOCH FROM NOW())*1000)::bigint,
       'TAB_SWITCH',
       '{"count":1}'::jsonb,
       gen_random_uuid()::text
FROM latest_session ls
-- avoid inserting the same event repeatedly in a short window
WHERE NOT EXISTS (
  SELECT 1 FROM events e
  WHERE e.session_id = ls.session_id AND e.event_type = 'TAB_SWITCH' AND e.created_at > now() - interval '5 minutes'
);

WITH latest_session AS (
  SELECT id AS session_id FROM sessions ORDER BY started_at DESC LIMIT 1
)
INSERT INTO events (id, session_id, ts, event_type, details, idempotency_key)
SELECT gen_random_uuid(),
       ls.session_id,
       (EXTRACT(EPOCH FROM NOW())*1000)::bigint,
       'PASTE',
       '{"field":"answer1"}'::jsonb,
       gen_random_uuid()::text
FROM latest_session ls
WHERE NOT EXISTS (
  SELECT 1 FROM events e
  WHERE e.session_id = ls.session_id AND e.event_type = 'PASTE' AND e.created_at > now() - interval '5 minutes'
);

-- 5) Insert sample media_snapshot (webcam image metadata) for latest session
WITH latest_session AS (
  SELECT id AS session_id FROM sessions ORDER BY started_at DESC LIMIT 1
)
INSERT INTO media_snapshots (id, session_id, ts, object_key, file_size, mime_type, uploaded_at, face_count, idempotency_key)
SELECT gen_random_uuid(),
       ls.session_id,
       (EXTRACT(EPOCH FROM NOW())*1000)::bigint,
       concat('samples/', ls.session_id::text, '/img-1.jpg')::text,
       12345,
       'image/jpeg',
       now(),
       1,
       gen_random_uuid()::text
FROM latest_session ls
WHERE NOT EXISTS (
  SELECT 1 FROM media_snapshots m WHERE m.session_id = ls.session_id AND m.object_key LIKE concat('samples/', ls.session_id::text, '/img-1.jpg')
);

-- 6) Insert two incidents (OPEN) for that session if not exists (TAB_ABUSE and PASTE)
WITH latest_session AS (
  SELECT id AS session_id FROM sessions ORDER BY started_at DESC LIMIT 1
)
INSERT INTO incidents (id, session_id, ts, type, score, reason, evidence_url, status)
SELECT gen_random_uuid(),
       ls.session_id,
       (EXTRACT(EPOCH FROM NOW())*1000)::bigint,
       'TAB_ABUSE',
       0.50,
       'Tab abuse demo',
       concat('samples/', ls.session_id::text, '/img-1.jpg'),
       'OPEN'
FROM latest_session ls
WHERE NOT EXISTS (
  SELECT 1 FROM incidents i WHERE i.session_id = ls.session_id AND i.type = 'TAB_ABUSE' AND i.created_at > now() - interval '1 day'
);

WITH latest_session AS (
  SELECT id AS session_id FROM sessions ORDER BY started_at DESC LIMIT 1
)
INSERT INTO incidents (id, session_id, ts, type, score, reason, evidence_url, status)
SELECT gen_random_uuid(),
       ls.session_id,
       (EXTRACT(EPOCH FROM NOW())*1000)::bigint,
       'PASTE',
       0.40,
       'Paste demo',
       concat('samples/', ls.session_id::text, '/img-1.jpg'),
       'OPEN'
FROM latest_session ls
WHERE NOT EXISTS (
  SELECT 1 FROM incidents i WHERE i.session_id = ls.session_id AND i.type = 'PASTE' AND i.created_at > now() - interval '1 day'
);

-- 7) Optionally create a review by 'reviewer' for one incident (mark CONFIRMED) once
WITH r AS (SELECT id FROM users WHERE username = 'reviewer' LIMIT 1),
     incident_to_review AS (
       SELECT id FROM incidents WHERE type = 'TAB_ABUSE' ORDER BY created_at DESC LIMIT 1
     )
INSERT INTO reviews (id, incident_id, reviewer_id, status, note)
SELECT gen_random_uuid(), ir.id, r.id, 'CONFIRMED', 'Sample confirm by reviewer'
FROM incident_to_review ir, r
ON CONFLICT (incident_id) DO NOTHING;

-- 8) Short verification selects (for convenience)
SELECT count(*) AS users_cnt FROM users;
SELECT id, username, role FROM users ORDER BY created_at;
SELECT id, name, created_at FROM exams ORDER BY created_at DESC LIMIT 5;
SELECT id, user_id, exam_id, started_at, status FROM sessions ORDER BY started_at DESC LIMIT 5;
SELECT id, session_id, event_type, to_timestamp(ts/1000.0) AS when_utc, details FROM events ORDER BY created_at DESC LIMIT 10;
SELECT id, session_id, type, status, reason, evidence_url FROM incidents ORDER BY created_at DESC LIMIT 10;
SELECT * FROM incidents_with_exam ORDER BY ts DESC LIMIT 10;
-- 06-incident-seed-data.sql
-- Seed data for incident_db
-- This file is loaded during Docker initialization

-- Connect to incident_db
\connect incident_db

-- Ensure pgcrypto available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Note: We need to get session_id from session_db, but we'll use a hardcoded approach
-- since cross-database queries are complex in PostgreSQL init scripts

-- For demo purposes, we'll create incidents with placeholder session_ids
-- In production, incidents would be created by the incident-service via Kafka/RabbitMQ

-- Insert sample incidents for testing
-- Note: session_id should reference an actual session from session_db
-- You may need to update these UUIDs after session_db is populated

-- Insert two sample incidents (OPEN)
INSERT INTO incidents (id, session_id, ts, type, score, reason, evidence_url, status)
VALUES 
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000'::uuid, -- Placeholder, will be updated by application
    (EXTRACT(EPOCH FROM NOW())*1000)::bigint,
    'TAB_ABUSE',
    0.50,
    'Tab abuse demo (seed data)',
    'samples/demo/img-tab-abuse.jpg',
    'OPEN'
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000'::uuid, -- Placeholder, will be updated by application
    (EXTRACT(EPOCH FROM NOW())*1000)::bigint,
    'PASTE',
    0.40,
    'Paste demo (seed data)',
    'samples/demo/img-paste.jpg',
    'OPEN'
  )
ON CONFLICT DO NOTHING;

-- Optionally create a sample review
-- Note: reviewer_id should reference identity_db.users(id)
-- For demo, we'll use a placeholder UUID
INSERT INTO reviews (id, incident_id, reviewer_id, status, note)
SELECT 
  gen_random_uuid(),
  i.id,
  'aaaaaaaa-aaaa-aaaa-aaaa-000000000002'::uuid, -- Placeholder for reviewer user ID
  'CONFIRMED',
  'Sample review from seed data'
FROM incidents i
WHERE i.type = 'TAB_ABUSE' AND i.reason LIKE '%seed data%'
LIMIT 1
ON CONFLICT (incident_id) DO NOTHING;

-- Verification selects
SELECT count(*) AS incidents_cnt FROM incidents;
SELECT id, session_id, type, status, reason FROM incidents ORDER BY created_at DESC LIMIT 10;
SELECT r.id, r.incident_id, r.status, r.note FROM reviews r ORDER BY reviewed_at DESC LIMIT 10;

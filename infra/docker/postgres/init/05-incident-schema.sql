-- 05-incident-schema.sql
-- Schema for incident_db - Incident management for exam proctoring
\connect incident_db

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- CORE TABLES (matching Java entities)
-- =============================================

-- Incidents table
-- Schema matches Incident.java entity in incident-service
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  type VARCHAR(100) NOT NULL,           -- MULTIPLE_FACES, NO_FACE, LOOKING_AWAY, TAB_SWITCH, etc.
  severity VARCHAR(50) NOT NULL,        -- LOW, MEDIUM, HIGH
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',  -- PENDING, UNDER_REVIEW, REVIEWED, DISMISSED, ESCALATED
  evidence_url VARCHAR(1000),
  object_key VARCHAR(500),
  file_size BIGINT,
  detected_by VARCHAR(50) NOT NULL,     -- FRONTEND_AI, SERVER_AI, PROCTOR
  detected_at TIMESTAMPTZ NOT NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by VARCHAR(255),
  consecutive_count INT,
  first_detected_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reviews table
-- Schema matches Review.java entity in incident-service
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  reviewed_by VARCHAR(255) NOT NULL,
  decision VARCHAR(50) NOT NULL,        -- VALID, FALSE_POSITIVE, ESCALATED, INCONCLUSIVE
  notes TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- SHADOW TABLE FOR CDC SYNC
-- =============================================

-- Session shadow table (synced from session_db.sessions via CDC)
CREATE TABLE IF NOT EXISTS session_shadow (
  session_id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  exam_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  deleted BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User shadow table (synced from identity_db.users via CDC)
CREATE TABLE IF NOT EXISTS user_shadow (
  user_id VARCHAR(255) PRIMARY KEY,
  full_name VARCHAR(255),
  email VARCHAR(255),
  student_code VARCHAR(100),
  role VARCHAR(50),
  deleted BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================

-- Incident indexes
CREATE INDEX IF NOT EXISTS idx_incidents_session_id ON incidents(session_id);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(type);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_detected_at ON incidents(detected_at);
CREATE INDEX IF NOT EXISTS idx_incidents_detected_by ON incidents(detected_by);

-- Review indexes
CREATE INDEX IF NOT EXISTS idx_reviews_incident_id ON reviews(incident_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_by ON reviews(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_reviews_decision ON reviews(decision);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_at ON reviews(reviewed_at DESC);

-- Session shadow indexes
CREATE INDEX IF NOT EXISTS idx_session_shadow_user ON session_shadow(user_id);
CREATE INDEX IF NOT EXISTS idx_session_shadow_exam ON session_shadow(exam_id);
CREATE INDEX IF NOT EXISTS idx_session_shadow_status ON session_shadow(status);

-- User shadow indexes
CREATE INDEX IF NOT EXISTS idx_user_shadow_email ON user_shadow(email);
CREATE INDEX IF NOT EXISTS idx_user_shadow_student_code ON user_shadow(student_code);

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE incidents IS 'Cheating incidents detected during exam sessions';
COMMENT ON TABLE reviews IS 'Proctor/Admin reviews of incidents';
COMMENT ON TABLE session_shadow IS 'Shadow copy of session_db.sessions synced via Kafka CDC';
COMMENT ON TABLE user_shadow IS 'Shadow copy of identity_db.users synced via Kafka CDC';

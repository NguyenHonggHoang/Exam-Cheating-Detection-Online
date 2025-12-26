-- V1: Initialize session_db schema
-- This migration creates the base tables for session-service
-- NOTE: User data is synced from identity_db via CDC (user_shadow table)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- ENUMS
-- =============================================
CREATE TYPE session_status AS ENUM ('ACTIVE', 'ENDED', 'ABORTED');
CREATE TYPE event_type AS ENUM ('TAB_SWITCH', 'PASTE', 'FOCUS', 'BLUR');

-- =============================================
-- SHADOW TABLE (synced from identity_db via CDC)
-- =============================================

-- User shadow table - synced from identity_db.users via Kafka CDC
-- This is the ONLY user data in session_db (microservices principle)
CREATE TABLE IF NOT EXISTS user_shadow (
  user_id VARCHAR(255) PRIMARY KEY,  -- OAuth2 subject ID from identity_db
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(50),
  enabled BOOLEAN DEFAULT true,
  deleted BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- CORE TABLES
-- =============================================

-- Exams table
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  retention_days INT NOT NULL DEFAULT 30,
  created_by VARCHAR(255),  -- References user_shadow.user_id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time)
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,  -- References user_shadow.user_id
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  status session_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at > started_at)
);

-- Media snapshots table (webcam images stored in MinIO)
CREATE TABLE IF NOT EXISTS media_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ts BIGINT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  file_size BIGINT,
  mime_type VARCHAR(100),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  face_count INT,
  idempotency_key VARCHAR(255) UNIQUE,
  CHECK (face_count IS NULL OR face_count >= 0)
);

-- Events table (browser telemetry)
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ts BIGINT NOT NULL,
  event_type event_type NOT NULL,
  details JSONB,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================

-- User shadow indexes
CREATE INDEX IF NOT EXISTS idx_user_shadow_username ON user_shadow(username);
CREATE INDEX IF NOT EXISTS idx_user_shadow_email ON user_shadow(email);
CREATE INDEX IF NOT EXISTS idx_user_shadow_role ON user_shadow(role);
CREATE INDEX IF NOT EXISTS idx_user_shadow_active ON user_shadow(deleted) WHERE deleted = false;

-- Core table indexes
CREATE INDEX IF NOT EXISTS idx_exams_created_by ON exams(created_by);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exam ON sessions(exam_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_media_snapshots_session_ts ON media_snapshots(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_session_ts ON events(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

-- =============================================
-- TRIGGERS
-- =============================================
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_exams ON exams;
CREATE TRIGGER set_updated_at_exams BEFORE UPDATE ON exams FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

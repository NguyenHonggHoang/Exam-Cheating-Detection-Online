-- 02-session-schema.sql
\connect session_db

-- (Content from schema.sql)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ... (Copying schema.sql content, but ensuring it runs on session_db)
-- [Truncated for brevity, but I will include the full content in the actual file write]
-- Note: I will paste the content of schema.sql here.

-- 2) Create enums
CREATE TYPE user_role AS ENUM ('ADMIN', 'PROCTOR', 'REVIEWER', 'CANDIDATE');
CREATE TYPE session_status AS ENUM ('ACTIVE', 'ENDED', 'ABORTED');
CREATE TYPE event_type AS ENUM ('TAB_SWITCH', 'PASTE', 'FOCUS', 'BLUR');
CREATE TYPE incident_type AS ENUM ('NO_FACE', 'MULTI_FACE', 'TAB_ABUSE', 'PASTE');
CREATE TYPE incident_status AS ENUM ('OPEN', 'CONFIRMED', 'REJECTED');
CREATE TYPE review_status AS ENUM ('CONFIRMED', 'REJECTED');

-- 3) Tables

-- users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'CANDIDATE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- exams
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  retention_days INT NOT NULL DEFAULT 30,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time)
);

-- sessions (allow multiple sessions per user/exam)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  status session_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at > started_at)
);

-- media_snapshots (webcam images)
CREATE TABLE IF NOT EXISTS media_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ts BIGINT NOT NULL, -- epoch milliseconds
  object_key TEXT NOT NULL UNIQUE,
  file_size BIGINT,
  mime_type VARCHAR(100),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  face_count INT, -- NULL until processed
  idempotency_key VARCHAR(255) UNIQUE,
  CHECK (face_count IS NULL OR face_count >= 0)
);

-- events (browser telemetry)
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ts BIGINT NOT NULL, -- epoch milliseconds
  event_type event_type NOT NULL,
  details JSONB,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- incidents (alerts)
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ts BIGINT NOT NULL, -- epoch milliseconds when incident created
  type incident_type NOT NULL,
  score NUMERIC(5,2),
  reason TEXT,
  evidence_url TEXT,
  status incident_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- reviews (proctor decisions) - one final review per incident (unique)
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status review_status NOT NULL,
  note TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (incident_id)
);

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_exams_created_by ON exams(created_by);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exam ON sessions(exam_id);
CREATE INDEX IF NOT EXISTS idx_media_snapshots_session_ts ON media_snapshots(session_id, ts);
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_snapshots_session_ts ON media_snapshots(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_session_ts ON events(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_events_session_ts_type ON events(session_id, ts, event_type);
CREATE INDEX IF NOT EXISTS idx_incidents_session_ts ON incidents(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_incidents_type_status ON incidents(type, status);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id);

-- 5) View
CREATE OR REPLACE VIEW incidents_with_exam AS
SELECT i.*, s.exam_id
FROM incidents i
JOIN sessions s ON s.id = i.session_id;

-- 6) Functions & Triggers
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_users ON users;
CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_exams ON exams;
CREATE TRIGGER set_updated_at_exams BEFORE UPDATE ON exams FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE OR REPLACE FUNCTION trg_sync_incident_status_from_review()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE incidents
    SET status = CASE NEW.status
      WHEN 'CONFIRMED' THEN 'CONFIRMED'::incident_status
      WHEN 'REJECTED' THEN 'REJECTED'::incident_status
    END
    WHERE id = NEW.incident_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_incident_status ON reviews;
CREATE TRIGGER trg_sync_incident_status AFTER INSERT OR UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION trg_sync_incident_status_from_review();

CREATE OR REPLACE FUNCTION trg_reopen_incident_on_review_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE incidents SET status = 'OPEN' WHERE id = OLD.incident_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reopen_incident ON reviews;
CREATE TRIGGER trg_reopen_incident AFTER DELETE ON reviews FOR EACH ROW EXECUTE FUNCTION trg_reopen_incident_on_review_delete();

-- V3: Create session_shadow table for CDC sync from session_db
-- This enables incident-service to track session status and auto-close incidents

CREATE TABLE session_shadow (
    session_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    exam_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    deleted BOOLEAN NOT NULL DEFAULT false,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_session_shadow_user ON session_shadow(user_id);
CREATE INDEX idx_session_shadow_exam ON session_shadow(exam_id);
CREATE INDEX idx_session_shadow_status ON session_shadow(status);

-- Composite index for active session queries
CREATE INDEX idx_session_shadow_active ON session_shadow(user_id, status) WHERE deleted = false;

-- Partial index for ended sessions
CREATE INDEX idx_session_shadow_ended ON session_shadow(status) WHERE status IN ('ENDED', 'ABORTED') AND deleted = false;

-- Add comments
COMMENT ON TABLE session_shadow IS 'Shadow copy of session_db.sessions synced via CDC for incident correlation';
COMMENT ON COLUMN session_shadow.deleted IS 'Soft delete flag - set when source session is deleted';
COMMENT ON COLUMN session_shadow.status IS 'Session status: ACTIVE, ENDED, or ABORTED';
COMMENT ON COLUMN session_shadow.synced_at IS 'Timestamp of last CDC sync from session_db';

-- V7: Drop FK constraint on session_id for development flexibility
-- Allow identity verifications to be stored without requiring existing sessions

ALTER TABLE identity_verifications DROP CONSTRAINT IF EXISTS identity_verifications_session_id_fkey;

COMMENT ON COLUMN identity_verifications.session_id IS 'Session ID (FK constraint removed for development flexibility)';

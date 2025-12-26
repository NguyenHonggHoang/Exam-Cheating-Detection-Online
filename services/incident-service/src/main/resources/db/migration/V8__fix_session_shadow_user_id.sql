-- V8: Fix session_shadow.user_id type to match session_db schema
-- session_db.sessions uses VARCHAR for user_id (OAuth2 subject ID)

ALTER TABLE session_shadow 
    ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::text;

COMMENT ON COLUMN session_shadow.user_id IS 'User ID (OAuth2 subject, VARCHAR not UUID)';

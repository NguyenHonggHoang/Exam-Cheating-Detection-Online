-- 04-bff-session-timeout.sql
-- Migration to add session timeout tracking columns
\connect bff_db

-- Add last_activity_at column to track user's last activity
ALTER TABLE refresh_tokens 
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add session_expires_at column to track absolute session expiration (24 hours from creation)
ALTER TABLE refresh_tokens 
ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMP WITH TIME ZONE;

-- Update existing rows to set session_expires_at (24 hours from created_at)
UPDATE refresh_tokens 
SET session_expires_at = created_at + INTERVAL '24 hours'
WHERE session_expires_at IS NULL;

-- Set default for new rows (will be set in application code, but this is a fallback)
ALTER TABLE refresh_tokens 
ALTER COLUMN session_expires_at SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours');

-- Create index for efficient queries on last_activity_at
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_last_activity_at ON refresh_tokens(last_activity_at);

-- Create index for efficient queries on session_expires_at
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session_expires_at ON refresh_tokens(session_expires_at);


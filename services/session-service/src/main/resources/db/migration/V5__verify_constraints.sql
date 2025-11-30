-- Migration V5: Verify and strengthen idempotency constraints
-- This migration ensures all unique constraints are properly in place

-- Verify media_snapshots has unique constraint on (session_id, ts)
-- Already exists from V1 as: uq_media_snapshots_session_ts
-- Re-create if not exists (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_snapshots_session_ts 
ON media_snapshots(session_id, ts);

-- Verify events has unique constraint on (session_id, ts, event_type)  
-- Already created in V4 as: uq_events_session_ts_type
-- Re-create if not exists (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS uq_events_session_ts_type 
ON events(session_id, ts, event_type);

-- Add comment for clarity
COMMENT ON INDEX uq_media_snapshots_session_ts IS 'Ensures idempotency for snapshots by (session_id, ts)';
COMMENT ON INDEX uq_events_session_ts_type IS 'Ensures idempotency for events by (session_id, ts, event_type)';

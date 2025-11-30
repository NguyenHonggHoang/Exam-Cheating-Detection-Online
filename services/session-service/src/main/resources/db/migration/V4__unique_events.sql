CREATE UNIQUE INDEX IF NOT EXISTS uq_events_session_ts_type 
ON events(session_id, ts, event_type);
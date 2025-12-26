-- V1__create_incidents_table.sql
-- Initial schema for incident-service

CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL,
    type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    evidence_url VARCHAR(1000),
    object_key VARCHAR(500),
    file_size BIGINT,
    detected_by VARCHAR(50) NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by VARCHAR(255),
    consecutive_count INTEGER,
    first_detected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_incident_session_id ON incidents(session_id);
CREATE INDEX IF NOT EXISTS idx_incident_type ON incidents(type);
CREATE INDEX IF NOT EXISTS idx_incident_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incident_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incident_detected_at ON incidents(detected_at);
CREATE INDEX IF NOT EXISTS idx_incident_detected_by ON incidents(detected_by);

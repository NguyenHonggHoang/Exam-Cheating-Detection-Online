-- V5__add_incident_notes_column.sql
-- Add notes column for incident review

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS notes TEXT;

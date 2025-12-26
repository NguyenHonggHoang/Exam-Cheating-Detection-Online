-- Add max_attempts column to exams table
-- NULL means unlimited attempts (default behavior)
ALTER TABLE exams ADD COLUMN IF NOT EXISTS max_attempts INTEGER;

COMMENT ON COLUMN exams.max_attempts IS 'Maximum number of exam attempts per student. NULL = unlimited (default)';

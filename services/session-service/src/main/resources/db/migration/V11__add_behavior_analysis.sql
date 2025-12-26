-- Add difficulty column to questions table
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS difficulty VARCHAR(10) NOT NULL DEFAULT 'MEDIUM';

-- Add behavior analysis columns to exam_session_states table
ALTER TABLE exam_session_states 
ADD COLUMN IF NOT EXISTS behavior_score INTEGER;

ALTER TABLE exam_session_states 
ADD COLUMN IF NOT EXISTS behavior_anomalies TEXT;

-- Update existing questions with default difficulty
UPDATE questions SET difficulty = 'MEDIUM' WHERE difficulty IS NULL;

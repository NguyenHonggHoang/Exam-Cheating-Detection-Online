-- Add calibration columns to sessions table
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS calibration_data TEXT,
ADD COLUMN IF NOT EXISTS calibration_timestamp TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN sessions.calibration_data IS 'JSON blob containing gaze calibration data (corners, boundaries)';
COMMENT ON COLUMN sessions.calibration_timestamp IS 'When the calibration was performed';

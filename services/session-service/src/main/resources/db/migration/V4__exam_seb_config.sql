-- V4: Add SEB (Safe Exam Browser) configuration to exams
-- Adds browser mode, SEB config key, and verification settings

-- Add duration_minutes column
ALTER TABLE exams ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

-- Add browser_mode enum column (NORMAL, SEB_REQUIRED, SEB_OPTIONAL)
ALTER TABLE exams ADD COLUMN IF NOT EXISTS browser_mode VARCHAR(20) DEFAULT 'NORMAL';

-- Add SEB config key for secure exam mode
ALTER TABLE exams ADD COLUMN IF NOT EXISTS seb_config_key VARCHAR(255);

-- Add ID verification requirement setting
ALTER TABLE exams ADD COLUMN IF NOT EXISTS require_id_verification BOOLEAN DEFAULT true;

-- Add maximum verification attempts setting
ALTER TABLE exams ADD COLUMN IF NOT EXISTS max_verification_attempts INTEGER DEFAULT 5;

-- Create index for browser mode queries
CREATE INDEX IF NOT EXISTS idx_exams_browser_mode ON exams(browser_mode);

-- Add constraint for valid browser modes
ALTER TABLE exams ADD CONSTRAINT chk_browser_mode 
    CHECK (browser_mode IN ('NORMAL', 'SEB_REQUIRED', 'SEB_OPTIONAL'));

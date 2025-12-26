-- V5__add_status_and_seed_exams.sql
-- Add status column to exams table and seed sample data

-- Add status column to exams table for easier querying
-- Status: DRAFT, SCHEDULED, ACTIVE, ENDED, CANCELLED
ALTER TABLE exams ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'DRAFT';

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status);

-- Add constraint for valid status values
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_exam_status'
    ) THEN
        ALTER TABLE exams ADD CONSTRAINT chk_exam_status 
            CHECK (status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED'));
    END IF;
END $$;

-- Insert 2 sample exams
INSERT INTO exams (id, name, description, start_time, end_time, duration_minutes, status, retention_days, browser_mode, require_id_verification, max_verification_attempts, created_at, updated_at)
VALUES 
    -- Exam 1: Active now (for testing)
    (
        'e1000000-0000-0000-0000-000000000001',
        'Toán cao cấp A1',
        'Kỳ thi cuối kỳ môn Toán cao cấp A1 - Học kỳ 1 năm học 2024-2025',
        NOW() - INTERVAL '1 hour',
        NOW() + INTERVAL '3 hours',
        90,
        'ACTIVE',
        30,
        'NORMAL',
        true,
        5,
        NOW(),
        NOW()
    ),
    -- Exam 2: Scheduled for tomorrow
    (
        'e2000000-0000-0000-0000-000000000002',
        'Lập trình Java',
        'Kỳ thi thực hành môn Lập trình Java - Kiểm tra giữa kỳ',
        NOW() + INTERVAL '1 day',
        NOW() + INTERVAL '1 day' + INTERVAL '2 hours',
        120,
        'SCHEDULED',
        30,
        'SEB_REQUIRED',
        true,
        3,
        NOW(),
        NOW()
    )
ON CONFLICT (id) DO NOTHING;

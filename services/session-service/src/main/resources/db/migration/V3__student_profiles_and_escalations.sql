-- V3: Student Profiles and Verification Escalations

-- Student Profile table for extended student information
CREATE TABLE IF NOT EXISTS student_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    student_id VARCHAR(100),
    faculty VARCHAR(255),
    class_name VARCHAR(100),
    batch_year INTEGER,
    department VARCHAR(255),
    profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_student_profiles_user_id ON student_profiles(user_id);

-- Verification Escalation table for proctor manual review
CREATE TABLE IF NOT EXISTS verification_escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    snapshot_object_key VARCHAR(500) NOT NULL,
    id_photo_object_key VARCHAR(500),
    reason TEXT,
    attempt_count INTEGER DEFAULT 5,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    proctor_id VARCHAR(255),
    proctor_note TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    CONSTRAINT chk_escalation_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'))
);

-- Indexes for escalation queries
CREATE INDEX IF NOT EXISTS idx_verification_escalations_session_id ON verification_escalations(session_id);
CREATE INDEX IF NOT EXISTS idx_verification_escalations_status ON verification_escalations(status);
CREATE INDEX IF NOT EXISTS idx_verification_escalations_created_at ON verification_escalations(created_at);

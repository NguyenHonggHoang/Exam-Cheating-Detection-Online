-- =====================================================
-- Incident Service: Shadow Tables Indexes
-- =====================================================
-- Version: V6
-- Description: Add performance indexes for shadow tables
-- =====================================================

-- Session Shadow Indexes
-- Critical for fast incident filtering and validation

-- Index on exam_id (for dashboard: "Show all incidents for Exam X")
CREATE INDEX IF NOT EXISTS idx_session_shadow_exam_id 
    ON session_shadow(exam_id) 
    WHERE deleted = false;

-- Index on user_id (for dashboard: "Show all student's sessions")
CREATE INDEX IF NOT EXISTS idx_session_shadow_user_id 
    ON session_shadow(user_id) 
    WHERE deleted = false;

-- Index on status (for filtering active sessions)
CREATE INDEX IF NOT EXISTS idx_session_shadow_status 
    ON session_shadow(status) 
    WHERE deleted = false;

-- Composite index for common query: active sessions for exam
CREATE INDEX IF NOT EXISTS idx_session_shadow_exam_status 
    ON session_shadow(exam_id, status) 
    WHERE deleted = false;

-- Index on deleted flag (for soft delete queries)
CREATE INDEX IF NOT EXISTS idx_session_shadow_deleted 
    ON session_shadow(deleted);

-- Index on synced_at (for monitoring CDC lag)
CREATE INDEX IF NOT EXISTS idx_session_shadow_synced 
    ON session_shadow(synced_at DESC);

-- User Shadow Indexes
-- For student name search and email lookups

-- Already defined in entity, but ensure they exist
CREATE INDEX IF NOT EXISTS idx_user_shadow_email 
    ON user_shadow(email) 
    WHERE deleted = false;

CREATE INDEX IF NOT EXISTS idx_user_shadow_student_code 
    ON user_shadow(student_code) 
    WHERE deleted = false;

-- Index for full-text search on full_name
CREATE INDEX IF NOT EXISTS idx_user_shadow_fullname_lower 
    ON user_shadow(LOWER(full_name)) 
    WHERE deleted = false;

-- Index on role (for filtering students vs proctors)
CREATE INDEX IF NOT EXISTS idx_user_shadow_role 
    ON user_shadow(role) 
    WHERE deleted = false;

-- Index on deleted flag
CREATE INDEX IF NOT EXISTS idx_user_shadow_deleted 
    ON user_shadow(deleted);

-- =====================================================
-- Performance Statistics
-- =====================================================
COMMENT ON INDEX idx_session_shadow_exam_id IS 
    'Fast lookup: All sessions for a specific exam (proctor dashboard)';

COMMENT ON INDEX idx_session_shadow_exam_status IS 
    'Fast lookup: Active sessions for exam (real-time monitoring)';

COMMENT ON INDEX idx_user_shadow_fullname_lower IS 
    'Case-insensitive search: Student name autocomplete';

-- =====================================================
-- Query Examples (for reference)
-- =====================================================

-- Example 1: Find all active sessions for an exam
-- SELECT * FROM session_shadow 
-- WHERE exam_id = 'exam-123' AND status = 'ACTIVE' AND deleted = false;
-- → Uses: idx_session_shadow_exam_status

-- Example 2: Find session by ID with validation
-- SELECT * FROM session_shadow 
-- WHERE session_id = 'uuid' AND status = 'ACTIVE' AND deleted = false;
-- → Uses: PRIMARY KEY + idx_session_shadow_status

-- Example 3: Search students by name
-- SELECT * FROM user_shadow 
-- WHERE LOWER(full_name) LIKE '%john%' AND deleted = false;
-- → Uses: idx_user_shadow_fullname_lower

-- Example 4: CDC lag monitoring
-- SELECT session_id, synced_at, AGE(NOW(), synced_at) as lag
-- FROM session_shadow
-- ORDER BY synced_at DESC
-- LIMIT 10;
-- → Uses: idx_session_shadow_synced

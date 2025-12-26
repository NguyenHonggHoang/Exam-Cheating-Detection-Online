-- V4__create_user_shadow_table.sql
-- User shadow table for CDC sync from identity_db

CREATE TABLE IF NOT EXISTS user_shadow (
    user_id VARCHAR(255) PRIMARY KEY,
    full_name VARCHAR(255),
    email VARCHAR(255),
    student_code VARCHAR(100),
    role VARCHAR(50),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_shadow_email ON user_shadow(email);
CREATE INDEX IF NOT EXISTS idx_user_shadow_student_code ON user_shadow(student_code);
CREATE INDEX IF NOT EXISTS idx_user_shadow_deleted ON user_shadow(deleted);

COMMENT ON TABLE user_shadow IS 'Local cache of user data synced from identity_db via Kafka CDC';

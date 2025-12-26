-- Flyway Migration for Student Shadow Table
-- Version: V2__create_student_shadow_table.sql

CREATE TABLE IF NOT EXISTS student_shadow (
    user_id VARCHAR(255) PRIMARY KEY,
    full_name VARCHAR(255),
    student_code VARCHAR(50),
    email VARCHAR(255),
    synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups by student code
CREATE INDEX IF NOT EXISTS idx_student_shadow_code ON student_shadow(student_code);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_student_shadow_email ON student_shadow(email);

COMMENT ON TABLE student_shadow IS 'Local cache of user data synced from identity_db via Kafka CDC';
COMMENT ON COLUMN student_shadow.synced_at IS 'Timestamp of last sync from Kafka';

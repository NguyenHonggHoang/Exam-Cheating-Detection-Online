-- 03-bff-schema.sql
\connect bff_db

-- (Content from 02-bff-refresh-tokens.sql)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    user_id VARCHAR(255) PRIMARY KEY,
    encrypted_token TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_updated_at ON refresh_tokens(updated_at);

GRANT ALL PRIVILEGES ON TABLE refresh_tokens TO postgres;

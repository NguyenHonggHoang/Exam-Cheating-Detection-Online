
ALTER TABLE IF EXISTS sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE IF EXISTS exams DROP CONSTRAINT IF EXISTS exams_created_by_fkey;
ALTER TABLE IF EXISTS reviews DROP CONSTRAINT IF EXISTS reviews_reviewer_id_fkey;

TRUNCATE TABLE sessions,media_snapshots, events, incidents, reviews CASCADE;

ALTER TABLE sessions ALTER COLUMN user_id TYPE VARCHAR(255);

ALTER TABLE exams ALTER COLUMN created_by TYPE VARCHAR(255);

ALTER TABLE reviews ALTER COLUMN reviewer_id TYPE VARCHAR(255);

DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;

DROP INDEX IF EXISTS idx_users_role;

DROP TRIGGER IF EXISTS set_updated_at_users ON users;

CREATE INDEX IF NOT EXISTS idx_sessions_user_id_varchar ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_exams_created_by_varchar ON exams(created_by);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id_varchar ON reviews(reviewer_id);


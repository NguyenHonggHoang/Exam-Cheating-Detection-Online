-- Migrate events.details from JSONB to TEXT to avoid driver type mismatch
-- Reason: Hibernate was binding as VARCHAR causing: ERROR: column "details" is of type jsonb but expression is of type character varying
-- Safe conversion using explicit cast.

ALTER TABLE events
  ALTER COLUMN details TYPE TEXT USING details::text;

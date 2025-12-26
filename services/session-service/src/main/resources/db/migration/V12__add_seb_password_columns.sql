-- V12: Add missing SEB password and UI configuration columns to exams
-- These columns are used by the Exam entity's embedded SebConfig class

-- Add SEB password columns
ALTER TABLE exams ADD COLUMN IF NOT EXISTS seb_quit_password VARCHAR(100);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS seb_admin_password VARCHAR(100);

-- Add SEB UI configuration columns
ALTER TABLE exams ADD COLUMN IF NOT EXISTS seb_allow_wifi BOOLEAN DEFAULT true;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS seb_show_taskbar BOOLEAN DEFAULT true;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS seb_show_reload_button BOOLEAN DEFAULT true;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS seb_show_time BOOLEAN DEFAULT true;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS seb_show_input_language BOOLEAN DEFAULT true;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS seb_allow_quit BOOLEAN DEFAULT true;

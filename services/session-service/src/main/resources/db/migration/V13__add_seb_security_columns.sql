-- V13: Add comprehensive SEB security configuration columns
-- Adds VM detection, remote desktop blocking, multi-monitor blocking, 
-- screen capture blocking, kiosk mode, URL filter, and prohibited processes

-- VM & Remote Detection
ALTER TABLE exams ADD COLUMN IF NOT EXISTS seb_detect_virtual_machine BOOLEAN DEFAULT true;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS seb_allow_remote_desktop BOOLEAN DEFAULT false;

-- Display Security
ALTER TABLE exams ADD COLUMN IF NOT EXISTS seb_allow_multiple_displays BOOLEAN DEFAULT false;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS seb_allow_display_mirroring BOOLEAN DEFAULT false;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS seb_block_screen_capture BOOLEAN DEFAULT true;

-- Kiosk Mode
ALTER TABLE exams ADD COLUMN IF NOT EXISTS seb_enable_kiosk_mode BOOLEAN DEFAULT true;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS seb_enable_private_clipboard BOOLEAN DEFAULT true;

-- URL Filter Rules (JSON array of allowed URL patterns)
-- Example: ["^https://exam\\.example\\.com/.*"]
ALTER TABLE exams ADD COLUMN IF NOT EXISTS seb_url_filter_rules TEXT;

-- Prohibited Processes (JSON array of app identifiers)
-- Format: [{"identifier": "obs64.exe", "os": 1, "description": "OBS Studio"}, ...]
-- os: 1 = Windows, 2 = macOS
ALTER TABLE exams ADD COLUMN IF NOT EXISTS seb_prohibited_processes TEXT;

-- Seed active exams for testing
-- Note: Database does NOT have duration_minutes column, duration is calculated from start_time and end_time

-- Insert test users
INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at) VALUES
('11111111-2222-3333-4444-555555555555', 'admin_user', 'admin@test.com', '$2a$10$dummy', 'ADMIN', now(), now()),
('22222222-3333-4444-5555-666666666666', 'proctor_user', 'proctor@test.com', '$2a$10$dummy', 'PROCTOR', now(), now()),
('33333333-4444-5555-6666-777777777777', 'student_user1', 'student1@test.com', '$2a$10$dummy', 'CANDIDATE', now(), now()),
('44444444-5555-6666-7777-888888888888', 'student_user2', 'student2@test.com', '$2a$10$dummy', 'CANDIDATE', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Insert ACTIVE exams (with start_time in past, end_time in future)
INSERT INTO exams (id, name, description, start_time, end_time, retention_days, created_by, created_at, updated_at) VALUES
('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 
 'Đề thi Toán học', 
 'Kỳ thi giữa kỳ môn Toán - Chương 1-5', 
 now() - interval '1 hour',  -- Started 1 hour ago
 now() + interval '2 hours', -- Ends in 2 hours (duration: 3 hours = 180 minutes)
 30, 
 '11111111-2222-3333-4444-555555555555', 
 now(), 
 now()),
 
('bbbbbbbb-cccc-dddd-eeee-ffffffffffff', 
 'Đề thi Tiếng Anh', 
 'Kỳ thi cuối kỳ - Reading & Writing', 
 now() - interval '30 minutes', -- Started 30 min ago
 now() + interval '30 minutes', -- Ends in 30 min (duration: 1 hour = 60 minutes)
 60, 
 '11111111-2222-3333-4444-555555555555', 
 now(), 
 now()),
 
('cccccccc-dddd-eeee-ffff-000000000000', 
 'Đề thi Vật lý', 
 'Quiz nhanh - Cơ học & Nhiệt học', 
 now() - interval '15 minutes', -- Started 15 min ago
 now() + interval '15 minutes', -- Ends in 15 min (duration: 30 minutes)
 14, 
 '11111111-2222-3333-4444-555555555555', 
 now(), 
 now())
ON CONFLICT (id) DO NOTHING;

-- Insert UPCOMING exam (starts in future)
INSERT INTO exams (id, name, description, start_time, end_time, retention_days, created_by, created_at, updated_at) VALUES
('dddddddd-eeee-ffff-0000-111111111111', 
 'Đề thi Hóa học (Sắp tới)', 
 'Kỳ thi cuối kỳ môn Hóa học', 
 now() + interval '1 day',    -- Starts tomorrow
 now() + interval '1 day 1 hour', -- 1 hour duration
 90, 
 '11111111-2222-3333-4444-555555555555', 
 now(), 
 now())
ON CONFLICT (id) DO NOTHING;

-- Insert ENDED exam (ended in past)
INSERT INTO exams (id, name, description, start_time, end_time, retention_days, created_by, created_at, updated_at) VALUES
('eeeeeeee-ffff-0000-1111-222222222222', 
 'Đề thi Lịch sử (Đã kết thúc)', 
 'Kỳ thi đã hoàn thành', 
 now() - interval '3 days',        -- Started 3 days ago
 now() - interval '3 days' + interval '45 minutes', -- Ended 3 days ago (45 min duration)
 90, 
 '11111111-2222-3333-4444-555555555555', 
 now() - interval '3 days', 
 now())
ON CONFLICT (id) DO NOTHING;

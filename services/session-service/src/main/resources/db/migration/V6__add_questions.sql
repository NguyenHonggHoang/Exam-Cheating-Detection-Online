-- V6__add_questions.sql
-- Add questions table for exam questions

-- Create question type enum
CREATE TYPE question_type AS ENUM ('MULTIPLE_CHOICE', 'TEXT', 'TRUE_FALSE');

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question_order INT NOT NULL DEFAULT 0,
    type question_type NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    text TEXT NOT NULL,
    options JSONB,  -- Array of options for multiple choice, e.g. ["A", "B", "C", "D"]
    correct_answer TEXT,
    points INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_questions_exam_order ON questions(exam_id, question_order);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_updated_at_questions ON questions;
CREATE TRIGGER set_updated_at_questions BEFORE UPDATE ON questions 
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- =============================================
-- SEED QUESTIONS FOR EXAM 1: Toán cao cấp A1
-- =============================================
INSERT INTO questions (id, exam_id, question_order, type, text, options, correct_answer, points) VALUES
    -- Math exam questions
    ('a1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 1, 'MULTIPLE_CHOICE',
     'Tính đạo hàm của hàm số f(x) = x² + 3x - 5',
     '["2x + 3", "x² + 3", "2x - 5", "x + 3"]'::jsonb,
     '2x + 3', 1),
    
    ('a1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 2, 'MULTIPLE_CHOICE',
     'Tích phân ∫(2x)dx = ?',
     '["x²", "x² + C", "2x²", "x + C"]'::jsonb,
     'x² + C', 1),
    
    ('a1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000001', 3, 'MULTIPLE_CHOICE',
     'Giới hạn lim(x→0) sin(x)/x = ?',
     '["0", "1", "∞", "Không tồn tại"]'::jsonb,
     '1', 1),
    
    ('a1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000001', 4, 'TRUE_FALSE',
     'Hàm số f(x) = x³ là hàm chẵn',
     '["Đúng", "Sai"]'::jsonb,
     'Sai', 1),
    
    ('a1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000001', 5, 'TEXT',
     'Tính giá trị của biểu thức: 2³ + 3² = ?',
     NULL,
     '17', 2)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- SEED QUESTIONS FOR EXAM 2: Lập trình Java
-- =============================================
INSERT INTO questions (id, exam_id, question_order, type, text, options, correct_answer, points) VALUES
    -- Java exam questions
    ('a2000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002', 1, 'MULTIPLE_CHOICE',
     'Java là ngôn ngữ lập trình hướng đối tượng?',
     '["Đúng", "Sai"]'::jsonb,
     'Đúng', 1),
    
    ('a2000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000002', 2, 'MULTIPLE_CHOICE',
     'Từ khóa nào dùng để kế thừa class trong Java?',
     '["implements", "extends", "inherits", "super"]'::jsonb,
     'extends', 1),
    
    ('a2000000-0000-0000-0000-000000000003', 'e2000000-0000-0000-0000-000000000002', 3, 'MULTIPLE_CHOICE',
     'HTTP status code 200 có nghĩa là?',
     '["Not Found", "OK", "Server Error", "Unauthorized"]'::jsonb,
     'OK', 1),
    
    ('a2000000-0000-0000-0000-000000000004', 'e2000000-0000-0000-0000-000000000002', 4, 'MULTIPLE_CHOICE',
     'Database nào sau đây là SQL?',
     '["MongoDB", "Redis", "PostgreSQL", "Cassandra"]'::jsonb,
     'PostgreSQL', 1),
    
    ('a2000000-0000-0000-0000-000000000005', 'e2000000-0000-0000-0000-000000000002', 5, 'TEXT',
     'Spring Boot là gì?',
     NULL,
     'Framework Java để phát triển ứng dụng', 2),
    
    ('a2000000-0000-0000-0000-000000000006', 'e2000000-0000-0000-0000-000000000002', 6, 'TEXT',
     'REST API là gì?',
     NULL,
     'Kiến trúc API dựa trên HTTP', 2),
    
    ('a2000000-0000-0000-0000-000000000007', 'e2000000-0000-0000-0000-000000000002', 7, 'MULTIPLE_CHOICE',
     'Annotation @Autowired dùng để làm gì?',
     '["Inject dependency", "Tạo Bean mới", "Đánh dấu API endpoint", "Log message"]'::jsonb,
     'Inject dependency', 1),
    
    ('a2000000-0000-0000-0000-000000000008', 'e2000000-0000-0000-0000-000000000002', 8, 'TRUE_FALSE',
     'JPA là một implementation của Hibernate',
     '["Đúng", "Sai"]'::jsonb,
     'Sai', 1)
ON CONFLICT (id) DO NOTHING;


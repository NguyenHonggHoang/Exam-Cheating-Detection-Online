-- V8: Add secure question system with anti-screenshot features
-- Features:
-- 1. Question templates with dynamic parameters
-- 2. Session state tracking for one-by-one question reveal
-- 3. Per-question time limits
-- 4. No backtracking support

-- Question templates with parameterized text
CREATE TABLE question_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question_order INTEGER NOT NULL,
    
    -- Template text with placeholders: "What is {{A}} + {{B}}?"
    template_text TEXT NOT NULL,
    
    -- Question type
    type VARCHAR(20) NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    
    -- Parameters config for randomization
    -- Example: { "A": {"type": "integer", "min": 10, "max": 99}, "B": {"type": "integer", "min": 10, "max": 99} }
    parameters JSONB,
    
    -- Options template with placeholders
    -- Example: ["{{A}} + {{B}}", "{{A}} - {{B}}", "{{A}} * 2", "{{B}} * 2"]
    options_template JSONB,
    
    -- Answer formula: evaluated with parameters
    -- Example: "{{A}} + {{B}}" or static like "Paris"
    answer_formula VARCHAR(500),
    
    -- Difficulty for time limit calculation
    difficulty VARCHAR(20) NOT NULL DEFAULT 'medium',
    
    -- Time limit for this question (seconds)
    time_limit_seconds INTEGER NOT NULL DEFAULT 60,
    
    -- Points for this question
    points INTEGER NOT NULL DEFAULT 1,
    
    -- Embedded state: depends on previous answer
    depends_on_previous BOOLEAN DEFAULT FALSE,
    dependency_formula VARCHAR(500), -- e.g., "{{PREV_ANSWER}} * 2"
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_question_templates_exam ON question_templates(exam_id);
CREATE INDEX idx_question_templates_order ON question_templates(exam_id, question_order);

-- Exam session state for secure question delivery
CREATE TABLE exam_session_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    
    -- Current question index (0-based)
    current_question_index INTEGER NOT NULL DEFAULT 0,
    
    -- Pre-generated questions for this session (randomized values)
    -- Array of: { "templateId": "uuid", "generatedText": "...", "generatedOptions": [...], "correctAnswer": "...", "params": {...} }
    generated_questions JSONB NOT NULL DEFAULT '[]',
    
    -- Submitted answers (can't go back)
    -- Array of: { "questionIndex": 0, "answer": "A", "submittedAt": timestamp, "timeSpentMs": 12345 }
    submitted_answers JSONB NOT NULL DEFAULT '[]',
    
    -- Last activity timestamp (for idle detection)
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Per-question start time
    current_question_started_at TIMESTAMPTZ,
    
    -- Session lock status
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    lock_reason VARCHAR(100),
    locked_at TIMESTAMPTZ,
    
    -- Exam completion
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    final_score INTEGER,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(session_id)
);

CREATE INDEX idx_session_state_session ON exam_session_states(session_id);
CREATE INDEX idx_session_state_locked ON exam_session_states(is_locked) WHERE is_locked = TRUE;

-- Add secure_mode flag to exams
ALTER TABLE exams ADD COLUMN IF NOT EXISTS secure_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS allow_backtracking BOOLEAN DEFAULT TRUE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS idle_timeout_seconds INTEGER DEFAULT 30;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_question_templates_updated_at
    BEFORE UPDATE ON question_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_session_states_updated_at
    BEFORE UPDATE ON exam_session_states
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sample question templates for testing
INSERT INTO question_templates (exam_id, question_order, template_text, type, parameters, options_template, answer_formula, difficulty, time_limit_seconds, points)
SELECT 
    e.id,
    1,
    'A store has {{INITIAL}} items. {{SOLD}} items were sold, then {{RECEIVED}} items were received. How many items are there now?',
    'TEXT',
    '{"INITIAL": {"type": "integer", "min": 100, "max": 500}, "SOLD": {"type": "integer", "min": 10, "max": 50}, "RECEIVED": {"type": "integer", "min": 20, "max": 80}}',
    NULL,
    '{{INITIAL}} - {{SOLD}} + {{RECEIVED}}',
    'medium',
    45,
    1
FROM exams e
LIMIT 1;

INSERT INTO question_templates (exam_id, question_order, template_text, type, parameters, options_template, answer_formula, difficulty, time_limit_seconds, points)
SELECT 
    e.id,
    2,
    'Calculate: {{A}} × {{B}} = ?',
    'MULTIPLE_CHOICE',
    '{"A": {"type": "integer", "min": 5, "max": 15}, "B": {"type": "integer", "min": 3, "max": 12}}',
    '["{{A}} * {{B}}", "{{A}} + {{B}}", "{{A}} * {{B}} + {{A}}", "{{A}} * {{B}} - {{B}}"]',
    '{{A}} * {{B}}',
    'easy',
    30,
    1
FROM exams e
LIMIT 1;

INSERT INTO question_templates (exam_id, question_order, template_text, type, parameters, options_template, answer_formula, difficulty, time_limit_seconds, points, depends_on_previous, dependency_formula)
SELECT 
    e.id,
    3,
    'Using the result from the previous question as a starting value, subtract {{SUBTRACT}}. What is the final result?',
    'TEXT',
    '{"SUBTRACT": {"type": "integer", "min": 10, "max": 30}}',
    NULL,
    '{{PREV_ANSWER}} - {{SUBTRACT}}',
    'medium',
    45,
    2,
    TRUE,
    '{{PREV_ANSWER}} - {{SUBTRACT}}'
FROM exams e
LIMIT 1;

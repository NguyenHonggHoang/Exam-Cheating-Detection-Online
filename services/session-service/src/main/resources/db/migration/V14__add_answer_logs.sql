-- Add answer_logs table for storing answer behavior metrics
CREATE TABLE answer_logs (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL,
    exam_id UUID NOT NULL,
    question_id VARCHAR(255) NOT NULL,
    question_index INT NOT NULL,
    selected_answer TEXT,
    difficulty VARCHAR(20),
    
    -- Behavior metrics
    time_to_answer_ms INT,
    revision_count INT,
    answer_changes_json TEXT,
    average_typing_speed FLOAT,
    had_pre_suspicion_during BOOLEAN,
    
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_answer_session_id ON answer_logs(session_id);
CREATE INDEX idx_answer_exam_id ON answer_logs(exam_id);
CREATE INDEX idx_answer_question_id ON answer_logs(question_id);

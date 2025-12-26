-- Add behavior_analyses table for storing answer behavior analysis
CREATE TABLE behavior_analyses (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL,
    exam_id UUID NOT NULL,
    
    overall_score FLOAT,
    anomalies_json TEXT,
    statistics_json TEXT,
    patterns_json TEXT,
    
    analyzed_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_behavior_session_id ON behavior_analyses(session_id);
CREATE INDEX idx_behavior_exam_id ON behavior_analyses(exam_id);
CREATE INDEX idx_behavior_overall_score ON behavior_analyses(overall_score);

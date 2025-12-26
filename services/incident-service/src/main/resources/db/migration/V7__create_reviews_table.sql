-- =====================================================
-- Incident Service: Review Table
-- =====================================================
-- Version: V7
-- Description: Add reviews table for incident reviews
-- =====================================================

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL,
    reviewed_by VARCHAR(255) NOT NULL,
    decision VARCHAR(50) NOT NULL,
    notes TEXT,
    reviewed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_review_incident FOREIGN KEY (incident_id) 
        REFERENCES incidents(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_review_incident_id ON reviews(incident_id);
CREATE INDEX IF NOT EXISTS idx_review_reviewed_by ON reviews(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_review_decision ON reviews(decision);
CREATE INDEX IF NOT EXISTS idx_review_reviewed_at ON reviews(reviewed_at DESC);

-- Comments
COMMENT ON TABLE reviews IS 'Proctor/Admin reviews of incidents';
COMMENT ON COLUMN reviews.decision IS 'Review decision: VALID, FALSE_POSITIVE, ESCALATED, INCONCLUSIVE';
COMMENT ON COLUMN reviews.reviewed_by IS 'User ID of reviewer (proctor or admin)';

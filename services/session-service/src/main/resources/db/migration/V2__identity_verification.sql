-- V2: Add identity verification tables for face comparison
-- Stores student ID photos and face embeddings for verification

-- =============================================
-- IDENTITY VERIFICATION TABLES
-- =============================================

-- Student identity photos (ID card photos uploaded during registration)
CREATE TABLE IF NOT EXISTS student_identity_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL UNIQUE,  -- References user_shadow.user_id (one photo per user)
    object_key TEXT NOT NULL,              -- MinIO object key for ID photo
    original_filename VARCHAR(255),
    file_size BIGINT,
    mime_type VARCHAR(100) DEFAULT 'image/jpeg',
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',  -- PENDING, VERIFIED, REJECTED
    verified_at TIMESTAMPTZ,
    verified_by VARCHAR(255),              -- Admin who verified
    rejection_reason TEXT,
    
    -- Timestamps
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Face embeddings extracted from photos
CREATE TABLE IF NOT EXISTS face_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,         -- References user_shadow.user_id
    source_type VARCHAR(50) NOT NULL,      -- 'ID_PHOTO' or 'EXAM_SNAPSHOT'
    source_id UUID,                        -- References student_identity_photos.id or media_snapshots.id
    
    -- Embedding data
    embedding_model VARCHAR(50) NOT NULL,  -- 'arcface', 'dlib', etc.
    embedding_dimension INT NOT NULL,      -- 512 for ArcFace, 128 for dlib
    embedding BYTEA NOT NULL,              -- Binary embedding vector (more efficient than JSON array)
    embedding_json JSONB,                  -- JSON array for debugging/analysis (optional)
    
    -- Quality metrics
    face_detected BOOLEAN NOT NULL DEFAULT true,
    face_count INT DEFAULT 1,
    confidence FLOAT,
    
    -- Timestamps
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES user_shadow(user_id) ON DELETE CASCADE
);

-- Identity verification results (comparison history)
CREATE TABLE IF NOT EXISTS identity_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    
    -- Comparison details
    reference_embedding_id UUID REFERENCES face_embeddings(id),  -- From ID photo
    probe_embedding_id UUID REFERENCES face_embeddings(id),      -- From exam snapshot
    
    -- Results
    verified BOOLEAN NOT NULL,
    confidence FLOAT NOT NULL,             -- 0.0 - 1.0
    similarity FLOAT NOT NULL,             -- Raw similarity score
    threshold FLOAT NOT NULL,              -- Threshold used for decision
    
    -- Face detection status
    reference_face_detected BOOLEAN NOT NULL DEFAULT true,
    probe_face_detected BOOLEAN NOT NULL DEFAULT true,
    
    -- Evidence
    reference_url TEXT,                    -- URL to ID photo
    probe_url TEXT,                        -- URL to exam snapshot
    probe_object_key TEXT,                 -- MinIO key for snapshot
    
    -- Message
    message TEXT,
    
    -- Processing info
    processing_time_ms INT,
    model_used VARCHAR(50),                -- 'arcface', 'dlib'
    
    -- Timestamps
    verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================

-- Student identity photos
CREATE INDEX IF NOT EXISTS idx_identity_photos_user ON student_identity_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_photos_status ON student_identity_photos(status);
CREATE INDEX IF NOT EXISTS idx_identity_photos_uploaded ON student_identity_photos(uploaded_at);

-- Face embeddings
CREATE INDEX IF NOT EXISTS idx_face_embeddings_user ON face_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_source ON face_embeddings(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_model ON face_embeddings(embedding_model);

-- Identity verifications
CREATE INDEX IF NOT EXISTS idx_identity_verifications_session ON identity_verifications(session_id);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_user ON identity_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_verified ON identity_verifications(verified);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_time ON identity_verifications(verified_at);

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE student_identity_photos IS 'Student ID card photos uploaded during registration for face verification';
COMMENT ON TABLE face_embeddings IS 'Face embeddings extracted from photos for face comparison';
COMMENT ON TABLE identity_verifications IS 'History of identity verification comparisons during exams';

COMMENT ON COLUMN face_embeddings.embedding IS 'Binary representation of face embedding vector (512-dim for ArcFace, 128-dim for dlib)';
COMMENT ON COLUMN identity_verifications.confidence IS 'Confidence score 0.0-1.0, higher is better';
COMMENT ON COLUMN identity_verifications.similarity IS 'Raw cosine similarity between embeddings';

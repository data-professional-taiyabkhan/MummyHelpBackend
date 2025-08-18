-- Migration: 0002_voice_tables.sql
-- Add tables for voice enrollment and verification

-- Create voiceprints table for storing child voice embeddings
CREATE TABLE IF NOT EXISTS voiceprints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    child_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    embedding FLOAT8[] NOT NULL,    -- 192-dim vector from SpeechBrain ECAPA
    samples INT NOT NULL DEFAULT 5,
    threshold FLOAT8 NOT NULL DEFAULT 0.78,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create voice enrollment audit table for tracking enrollment attempts
CREATE TABLE IF NOT EXISTS voice_enroll_audit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT,
    success BOOLEAN NOT NULL,
    snr_avg FLOAT8,
    error_message TEXT,
    samples_recorded INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create voice verification audit table for tracking verification attempts
CREATE TABLE IF NOT EXISTS voice_verify_audit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT,
    score FLOAT8,
    match BOOLEAN,
    threshold_used FLOAT8,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for voiceprints
CREATE INDEX IF NOT EXISTS idx_voiceprints_child_id ON voiceprints(child_id);
CREATE INDEX IF NOT EXISTS idx_voiceprints_created_at ON voiceprints(created_at);

-- Create indexes for voice enrollment audit
CREATE INDEX IF NOT EXISTS idx_voice_enroll_audit_child_id ON voice_enroll_audit(child_id);
CREATE INDEX IF NOT EXISTS idx_voice_enroll_audit_created_at ON voice_enroll_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_voice_enroll_audit_success ON voice_enroll_audit(success);

-- Create indexes for voice verification audit
CREATE INDEX IF NOT EXISTS idx_voice_verify_audit_child_id ON voice_verify_audit(child_id);
CREATE INDEX IF NOT EXISTS idx_voice_verify_audit_created_at ON voice_verify_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_voice_verify_audit_match ON voice_verify_audit(match);

-- Create function to update updated_at timestamp for voiceprints
CREATE OR REPLACE FUNCTION update_voiceprints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for voiceprints updated_at
CREATE TRIGGER update_voiceprints_updated_at 
    BEFORE UPDATE ON voiceprints 
    FOR EACH ROW 
    EXECUTE FUNCTION update_voiceprints_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE voiceprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_enroll_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_verify_audit ENABLE ROW LEVEL SECURITY;

-- Create policies for voiceprints
CREATE POLICY "Users can manage their own voiceprints" ON voiceprints
    FOR ALL USING (auth.uid()::text = child_id::text);

-- Allow paired users to view each other's voiceprints (for family verification)
CREATE POLICY "Paired users can view voiceprints" ON voiceprints
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid()::uuid 
            AND u.paired_with = voiceprints.child_id
        )
    );

-- Create policies for voice enrollment audit
CREATE POLICY "Users can view their own voice enroll audit" ON voice_enroll_audit
    FOR SELECT USING (auth.uid()::text = child_id::text);

CREATE POLICY "Users can create their own voice enroll audit" ON voice_enroll_audit
    FOR INSERT WITH CHECK (auth.uid()::text = child_id::text);

-- Allow paired users to view each other's enrollment audit
CREATE POLICY "Paired users can view voice enroll audit" ON voice_enroll_audit
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid()::uuid 
            AND u.paired_with = voice_enroll_audit.child_id
        )
    );

-- Create policies for voice verification audit
CREATE POLICY "Users can view their own voice verify audit" ON voice_verify_audit
    FOR SELECT USING (auth.uid()::text = child_id::text);

CREATE POLICY "Users can create their own voice verify audit" ON voice_verify_audit
    FOR INSERT WITH CHECK (auth.uid()::text = child_id::text);

-- Allow paired users to view each other's verification audit
CREATE POLICY "Paired users can view voice verify audit" ON voice_verify_audit
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid()::uuid 
            AND u.paired_with = voice_verify_audit.child_id
        )
    );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON voiceprints TO anon, authenticated;
GRANT ALL ON voice_enroll_audit TO anon, authenticated;
GRANT ALL ON voice_verify_audit TO anon, authenticated;

-- Note: Role validation is handled at the application level in the API routes
-- CHECK constraints cannot use subqueries in PostgreSQL

-- Migration: 0001_init_push_loc.sql
-- Add tables for device tokens, alerts, and locations

-- Create device_tokens table
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    expo_push_token TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_platform ON device_tokens(platform);

-- Create alerts table (replacing in-memory storage)
CREATE TABLE IF NOT EXISTS alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('emergency', 'help', 'check-in')),
    message TEXT,
    location TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id),
    cancelled BOOLEAN DEFAULT FALSE,
    cancelled_at TIMESTAMPTZ
);

-- Create indexes for alerts
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);

-- Create locations table for tracking child location
CREATE TABLE IF NOT EXISTS locations (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    altitude DOUBLE PRECISION,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for locations
CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations(user_id);
CREATE INDEX IF NOT EXISTS idx_locations_alert_id ON locations(alert_id);
CREATE INDEX IF NOT EXISTS idx_locations_created_at ON locations(created_at);

-- Create function to update updated_at timestamp for device_tokens
CREATE OR REPLACE FUNCTION update_device_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for device_tokens updated_at
CREATE TRIGGER update_device_tokens_updated_at 
    BEFORE UPDATE ON device_tokens 
    FOR EACH ROW 
    EXECUTE FUNCTION update_device_tokens_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Create policies for device_tokens
CREATE POLICY "Users can manage their own device tokens" ON device_tokens
    FOR ALL USING (auth.uid()::text = user_id::text);

-- Create policies for alerts
CREATE POLICY "Users can view their own alerts" ON alerts
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create their own alerts" ON alerts
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own alerts" ON alerts
    FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Allow paired users to view each other's alerts
CREATE POLICY "Paired users can view alerts" ON alerts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid()::uuid 
            AND u.paired_with = alerts.user_id
        )
    );

-- Create policies for locations
CREATE POLICY "Users can view their own locations" ON locations
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create their own locations" ON locations
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Allow paired users to view each other's locations
CREATE POLICY "Paired users can view locations" ON locations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid()::uuid 
            AND u.paired_with = locations.user_id
        )
    );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON device_tokens TO anon, authenticated;
GRANT ALL ON alerts TO anon, authenticated;
GRANT ALL ON locations TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE locations_id_seq TO anon, authenticated;

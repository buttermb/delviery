-- Push Notification Tokens Table
-- Stores FCM/APNs tokens for mobile push notifications

CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint per user per tenant
    CONSTRAINT unique_user_tenant UNIQUE (user_id, tenant_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_push_tokens_tenant ON push_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens
CREATE POLICY push_tokens_select ON push_tokens
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY push_tokens_insert ON push_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY push_tokens_update ON push_tokens
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY push_tokens_delete ON push_tokens
    FOR DELETE USING (auth.uid() = user_id);

-- Service role can access all tokens (for sending notifications)
CREATE POLICY push_tokens_service ON push_tokens
    FOR ALL USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_push_tokens_updated_at
    BEFORE UPDATE ON push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_push_tokens_updated_at();

-- Notify on successful creation
DO $$ BEGIN RAISE NOTICE 'Created push_tokens table for mobile push notifications'; END $$;

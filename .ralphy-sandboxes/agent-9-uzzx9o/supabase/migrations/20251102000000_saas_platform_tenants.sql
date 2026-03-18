-- ============================================================================
-- SAAS PLATFORM - MULTI-TENANT ARCHITECTURE
-- ============================================================================

-- Tenants (Your customers - the wholesale businesses)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Business Info
    business_name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'bigmike-wholesale'
    owner_email VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255),
    phone VARCHAR(20),
    
    -- Subscription
    subscription_plan VARCHAR(50) NOT NULL DEFAULT 'starter', -- 'starter', 'professional', 'enterprise'
    subscription_status VARCHAR(20) DEFAULT 'trial', -- 'trial', 'active', 'past_due', 'cancelled', 'suspended'
    trial_ends_at TIMESTAMPTZ,
    subscription_started_at TIMESTAMPTZ,
    subscription_current_period_start TIMESTAMPTZ,
    subscription_current_period_end TIMESTAMPTZ,
    
    -- Billing
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    payment_method_added BOOLEAN DEFAULT false,
    next_billing_date DATE,
    mrr DECIMAL(10,2), -- Monthly Recurring Revenue
    
    -- Usage Limits (based on plan)
    limits JSONB DEFAULT '{
        "customers": 50,
        "menus": 3,
        "products": 100,
        "locations": 2,
        "users": 3
    }'::jsonb,
    
    -- Current Usage
    usage JSONB DEFAULT '{
        "customers": 0,
        "menus": 0,
        "products": 0,
        "locations": 0,
        "users": 1
    }'::jsonb,
    
    -- Features Enabled
    features JSONB DEFAULT '{
        "api_access": false,
        "custom_branding": false,
        "white_label": false,
        "advanced_analytics": false,
        "sms_enabled": false
    }'::jsonb,
    
    -- White-Label Settings
    white_label JSONB DEFAULT '{
        "enabled": false,
        "domain": null,
        "logo": null,
        "theme": {}
    }'::jsonb,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended', 'cancelled'
    suspended_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    
    -- Compliance
    state_licenses JSONB DEFAULT '[]'::jsonb,
    compliance_verified BOOLEAN DEFAULT false,
    
    -- Meta
    onboarded BOOLEAN DEFAULT false,
    onboarded_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant Users (Team members of each tenant)
CREATE TABLE IF NOT EXISTS public.tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    password_hash VARCHAR(255),
    role VARCHAR(50) DEFAULT 'viewer', -- 'owner', 'admin', 'manager', 'runner', 'viewer'
    
    -- Permissions
    permissions JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'active', 'suspended'
    email_verified BOOLEAN DEFAULT false,
    invited_by UUID REFERENCES public.tenant_users(id),
    invited_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, email)
);

-- Subscription Events Log
CREATE TABLE IF NOT EXISTS public.subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    event_type VARCHAR(50) NOT NULL, -- 'trial_started', 'subscribed', 'upgraded', 'downgraded', 'cancelled', 'payment_failed'
    from_plan VARCHAR(50),
    to_plan VARCHAR(50),
    amount DECIMAL(10,2),
    
    stripe_event_id VARCHAR(255),
    event_data JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage Tracking (for billing)
CREATE TABLE IF NOT EXISTS public.usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    event_type VARCHAR(50) NOT NULL, -- 'sms_sent', 'email_sent', 'label_printed', 'api_call'
    quantity INTEGER DEFAULT 1,
    metadata JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature Flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    enabled_for_plans TEXT[], -- ['professional', 'enterprise']
    rollout_percentage INTEGER DEFAULT 100, -- for gradual rollouts
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_subscription_status ON public.tenants(subscription_status);
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer_id ON public.tenants(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON public.tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON public.tenant_users(email);
CREATE INDEX IF NOT EXISTS idx_subscription_events_tenant_id ON public.subscription_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON public.subscription_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_id ON public.usage_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_event_type ON public.usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON public.usage_events(created_at DESC);

-- RLS Policies
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- RLS: Tenants can only see their own data
CREATE POLICY tenant_isolation_tenants ON public.tenants
    USING (id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE POLICY tenant_isolation_tenant_users ON public.tenant_users
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE POLICY tenant_isolation_subscription_events ON public.subscription_events
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE POLICY tenant_isolation_usage_events ON public.usage_events
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- Allow super admin access (for platform management)
CREATE POLICY super_admin_access_tenants ON public.tenants
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid()
            AND role = 'super_admin'
        )
    );

CREATE POLICY super_admin_access_tenant_users ON public.tenant_users
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid()
            AND role = 'super_admin'
        )
    );

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_users_updated_at BEFORE UPDATE ON public.tenant_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get plan limits
CREATE OR REPLACE FUNCTION get_plan_limits(plan_name VARCHAR)
RETURNS JSONB AS $$
BEGIN
    RETURN CASE plan_name
        WHEN 'starter' THEN '{
            "customers": 50,
            "menus": 3,
            "products": 100,
            "locations": 2,
            "users": 3
        }'::jsonb
        WHEN 'professional' THEN '{
            "customers": 500,
            "menus": -1,
            "products": -1,
            "locations": 10,
            "users": 10
        }'::jsonb
        WHEN 'enterprise' THEN '{
            "customers": -1,
            "menus": -1,
            "products": -1,
            "locations": -1,
            "users": -1
        }'::jsonb
        ELSE '{
            "customers": 50,
            "menus": 3,
            "products": 100,
            "locations": 2,
            "users": 3
        }'::jsonb
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get plan features
CREATE OR REPLACE FUNCTION get_plan_features(plan_name VARCHAR)
RETURNS JSONB AS $$
BEGIN
    RETURN CASE plan_name
        WHEN 'starter' THEN '{
            "api_access": false,
            "custom_branding": false,
            "white_label": false,
            "advanced_analytics": false,
            "sms_enabled": false
        }'::jsonb
        WHEN 'professional' THEN '{
            "api_access": true,
            "custom_branding": true,
            "white_label": false,
            "advanced_analytics": true,
            "sms_enabled": true
        }'::jsonb
        WHEN 'enterprise' THEN '{
            "api_access": true,
            "custom_branding": true,
            "white_label": true,
            "advanced_analytics": true,
            "sms_enabled": true
        }'::jsonb
        ELSE '{
            "api_access": false,
            "custom_branding": false,
            "white_label": false,
            "advanced_analytics": false,
            "sms_enabled": false
        }'::jsonb
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON TABLE public.tenants IS 'Multi-tenant table for SAAS platform - stores each wholesale business customer';
COMMENT ON TABLE public.tenant_users IS 'Team members for each tenant';
COMMENT ON TABLE public.subscription_events IS 'Audit log of all subscription changes';
COMMENT ON TABLE public.usage_events IS 'Usage tracking for billing (SMS, emails, labels, API calls)';


-- Business Admin Panel Tables (Loyalty, Marketing, Automation, Reports, etc.)

-- 1. Loyalty Program
CREATE TABLE IF NOT EXISTS public.loyalty_program_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    program_name TEXT NOT NULL DEFAULT 'Loyalty Program',
    points_per_dollar NUMERIC NOT NULL DEFAULT 1.0,
    points_to_dollar_ratio NUMERIC NOT NULL DEFAULT 0.01,
    signup_bonus_points INTEGER NOT NULL DEFAULT 0,
    birthday_bonus_points INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    tier_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

CREATE TABLE IF NOT EXISTS public.loyalty_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#000000',
    icon TEXT,
    multiplier NUMERIC NOT NULL DEFAULT 1.0,
    min_points INTEGER NOT NULL DEFAULT 0,
    max_points INTEGER,
    benefits TEXT[] DEFAULT '{}',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    points_cost INTEGER NOT NULL DEFAULT 0,
    reward_type TEXT NOT NULL, -- 'discount', 'free_item', etc.
    redemption_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_loyalty_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL, -- Can reference auth.users or a customers table
    total_points INTEGER NOT NULL DEFAULT 0,
    lifetime_points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, customer_id)
);

CREATE TABLE IF NOT EXISTS public.loyalty_reward_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL,
    reward_id UUID REFERENCES public.loyalty_rewards(id),
    points_spent INTEGER NOT NULL,
    redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Marketing Automation
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('email', 'sms', 'push')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'failed')),
    subject TEXT,
    content TEXT,
    audience_config JSONB DEFAULT '{}',
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Automation Rules
CREATE TABLE IF NOT EXISTS public.automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL,
    trigger_config JSONB DEFAULT '{}',
    action_type TEXT NOT NULL,
    action_config JSONB DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Custom Reports
CREATE TABLE IF NOT EXISTS public.custom_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sql_query TEXT,
    query JSONB, -- For visual builder
    format TEXT NOT NULL DEFAULT 'csv',
    schedule TEXT, -- Cron expression
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Webhooks
CREATE TABLE IF NOT EXISTS public.webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT[] DEFAULT '{}',
    secret TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Support Tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    subject TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Custom Integrations
CREATE TABLE IF NOT EXISTS public.custom_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Custom Domains
CREATE TABLE IF NOT EXISTS public.custom_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    verification_record TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(domain)
);

-- Enable RLS
ALTER TABLE public.loyalty_program_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies (Tenant Isolation)
-- Helper macro not available in SQL, so we repeat the policy pattern

-- Loyalty Config
CREATE POLICY "Tenant Access" ON public.loyalty_program_config
    USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Loyalty Tiers
CREATE POLICY "Tenant Access" ON public.loyalty_tiers
    USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Loyalty Rewards
CREATE POLICY "Tenant Access" ON public.loyalty_rewards
    USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Customer Points
CREATE POLICY "Tenant Access" ON public.customer_loyalty_points
    USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Redemptions
CREATE POLICY "Tenant Access" ON public.loyalty_reward_redemptions
    USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Marketing Campaigns
CREATE POLICY "Tenant Access" ON public.marketing_campaigns
    USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Automation Rules
CREATE POLICY "Tenant Access" ON public.automation_rules
    USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Custom Reports
CREATE POLICY "Tenant Access" ON public.custom_reports
    USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Webhooks
CREATE POLICY "Tenant Access" ON public.webhooks
    USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Support Tickets
CREATE POLICY "Tenant Access" ON public.support_tickets
    USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Custom Integrations
CREATE POLICY "Tenant Access" ON public.custom_integrations
    USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Custom Domains
CREATE POLICY "Tenant Access" ON public.custom_domains
    USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Grant permissions
GRANT ALL ON public.loyalty_program_config TO authenticated;
GRANT ALL ON public.loyalty_tiers TO authenticated;
GRANT ALL ON public.loyalty_rewards TO authenticated;
GRANT ALL ON public.customer_loyalty_points TO authenticated;
GRANT ALL ON public.loyalty_reward_redemptions TO authenticated;
GRANT ALL ON public.marketing_campaigns TO authenticated;
GRANT ALL ON public.automation_rules TO authenticated;
GRANT ALL ON public.custom_reports TO authenticated;
GRANT ALL ON public.webhooks TO authenticated;
GRANT ALL ON public.support_tickets TO authenticated;
GRANT ALL ON public.custom_integrations TO authenticated;
GRANT ALL ON public.custom_domains TO authenticated;

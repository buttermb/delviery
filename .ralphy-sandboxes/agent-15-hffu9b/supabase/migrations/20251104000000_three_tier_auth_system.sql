-- ============================================================================
-- THREE-TIER AUTHENTICATION SYSTEM
-- Complete separation: Super Admin, Tenant Admin, Customer Portal
-- ============================================================================

-- ============================================================================
-- LEVEL 1: SUPER ADMIN (Platform Owner)
-- ============================================================================

-- Super Admin Users (Platform owner and team)
CREATE TABLE IF NOT EXISTS public.super_admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Auth
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    
    -- Role
    role VARCHAR(50) DEFAULT 'admin', -- 'super_admin', 'admin', 'support', 'billing'
    permissions JSONB DEFAULT '{}'::jsonb,
    
    -- Security
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended', 'deleted'
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Super Admin Sessions
CREATE TABLE IF NOT EXISTS public.super_admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    super_admin_id UUID NOT NULL REFERENCES public.super_admin_users(id) ON DELETE CASCADE,
    
    token VARCHAR(500) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Super Admin Actions (Audit Log)
CREATE TABLE IF NOT EXISTS public.super_admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    super_admin_id UUID REFERENCES public.super_admin_users(id),
    
    action_type VARCHAR(50) NOT NULL, -- 'tenant_suspended', 'plan_changed', 'refund_issued', 'feature_granted'
    target_tenant_id UUID REFERENCES public.tenants(id),
    
    action_data JSONB DEFAULT '{}'::jsonb,
    reason TEXT,
    
    ip_address INET,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription Plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    name VARCHAR(50) UNIQUE NOT NULL, -- 'starter', 'professional', 'enterprise'
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Pricing
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2),
    
    -- Stripe
    stripe_price_id_monthly VARCHAR(255),
    stripe_price_id_yearly VARCHAR(255),
    
    -- Features
    features JSONB DEFAULT '[]'::jsonb, -- ['disposable_menus', 'custom_branding', 'api_access']
    
    -- Limits
    limits JSONB DEFAULT '{
        "customers_max": 50,
        "menus_max": 3,
        "products_max": 100,
        "team_members_max": 3,
        "storage_mb_max": 1024,
        "api_calls_per_month": 5000
    }'::jsonb,
    
    -- Status
    active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices (for ALL tenants)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Invoice Info
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Stripe
    stripe_invoice_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    
    -- Amounts
    subtotal DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    amount_due DECIMAL(10,2) NOT NULL,
    
    -- Line Items
    line_items JSONB DEFAULT '[]'::jsonb,
    
    -- Dates
    billing_period_start DATE,
    billing_period_end DATE,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    paid_at TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'open', 'paid', 'void', 'uncollectible'
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments (for ALL tenants)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.invoices(id),
    
    -- Payment Info
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Stripe
    stripe_payment_intent_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),
    
    -- Payment Method
    payment_method_type VARCHAR(50), -- 'card', 'bank_transfer'
    card_last4 VARCHAR(4),
    card_brand VARCHAR(20),
    
    -- Status
    status VARCHAR(20) NOT NULL, -- 'succeeded', 'pending', 'failed', 'refunded'
    failure_reason TEXT,
    
    -- Dates
    paid_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant Features (Feature toggles per tenant)
CREATE TABLE IF NOT EXISTS public.tenant_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    feature_name VARCHAR(100) NOT NULL, -- 'disposable_menus', 'api_access', 'white_label', etc.
    enabled BOOLEAN NOT NULL DEFAULT false,
    
    -- Custom limit (overrides plan default)
    custom_limit INTEGER,
    
    -- Temporary access
    expires_at TIMESTAMPTZ,
    
    -- Reason
    reason TEXT,
    granted_by UUID REFERENCES public.super_admin_users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, feature_name)
);

-- ============================================================================
-- LEVEL 2: TENANT ADMIN (Wholesale Business Owners)
-- ============================================================================

-- Enhance tenant_users table if needed (check if fields exist)
DO $$
BEGIN
    -- Add missing fields to tenant_users if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_users' AND column_name = 'password_hash') THEN
        ALTER TABLE public.tenant_users ADD COLUMN password_hash VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_users' AND column_name = 'first_name') THEN
        ALTER TABLE public.tenant_users ADD COLUMN first_name VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_users' AND column_name = 'last_name') THEN
        ALTER TABLE public.tenant_users ADD COLUMN last_name VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_users' AND column_name = 'avatar_url') THEN
        ALTER TABLE public.tenant_users ADD COLUMN avatar_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_users' AND column_name = 'two_factor_enabled') THEN
        ALTER TABLE public.tenant_users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_users' AND column_name = 'two_factor_secret') THEN
        ALTER TABLE public.tenant_users ADD COLUMN two_factor_secret VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_users' AND column_name = 'last_login_ip') THEN
        ALTER TABLE public.tenant_users ADD COLUMN last_login_ip INET;
    END IF;
END $$;

-- Tenant Admin Sessions
CREATE TABLE IF NOT EXISTS public.tenant_admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_admin_id UUID NOT NULL REFERENCES public.tenant_users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    token VARCHAR(500) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant Admin Activity Log
CREATE TABLE IF NOT EXISTS public.tenant_admin_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    tenant_admin_id UUID REFERENCES public.tenant_users(id),
    
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50), -- 'product', 'customer', 'order', 'menu'
    entity_id UUID,
    
    changes JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- LEVEL 3: CUSTOMER PORTAL (B2B Buyers)
-- ============================================================================

-- Customer Users (buyers from each tenant)
CREATE TABLE IF NOT EXISTS public.customer_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    
    -- Auth
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    
    -- Access
    role VARCHAR(50) DEFAULT 'buyer',
    can_place_orders BOOLEAN DEFAULT true,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended', 'deleted'
    email_verified BOOLEAN DEFAULT false,
    email_verified_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, email)
);

-- Customer Sessions
CREATE TABLE IF NOT EXISTS public.customer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_user_id UUID NOT NULL REFERENCES public.customer_users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    token VARCHAR(500) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_super_admin_users_email ON public.super_admin_users(email);
CREATE INDEX IF NOT EXISTS idx_super_admin_users_status ON public.super_admin_users(status);
CREATE INDEX IF NOT EXISTS idx_super_admin_sessions_token ON public.super_admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_super_admin_sessions_admin ON public.super_admin_sessions(super_admin_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_actions_admin ON public.super_admin_actions(super_admin_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_actions_tenant ON public.super_admin_actions(target_tenant_id);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_name ON public.subscription_plans(name);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans(active);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON public.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON public.invoices(stripe_invoice_id);

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON public.payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_stripe ON public.payments(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_tenant_features_tenant ON public.tenant_features(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_features_name ON public.tenant_features(feature_name);

CREATE INDEX IF NOT EXISTS idx_tenant_admin_sessions_token ON public.tenant_admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_tenant_admin_sessions_admin ON public.tenant_admin_sessions(tenant_admin_id);
CREATE INDEX IF NOT EXISTS idx_tenant_admin_sessions_tenant ON public.tenant_admin_sessions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_admin_activity_tenant ON public.tenant_admin_activity(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_admin_activity_admin ON public.tenant_admin_activity(tenant_admin_id);

CREATE INDEX IF NOT EXISTS idx_customer_users_tenant ON public.customer_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_users_email ON public.customer_users(email);
CREATE INDEX IF NOT EXISTS idx_customer_users_customer ON public.customer_users(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_users_status ON public.customer_users(status);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_token ON public.customer_sessions(token);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_user ON public.customer_sessions(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_tenant ON public.customer_sessions(tenant_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.super_admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_admin_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;

-- Super Admin Users Policies
CREATE POLICY "Super admins can view all super admin users"
ON public.super_admin_users FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.super_admin_users sau
        WHERE sau.id = auth.uid()::uuid
        AND sau.status = 'active'
    )
);

CREATE POLICY "Super admins can manage super admin users"
ON public.super_admin_users FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.super_admin_users sau
        WHERE sau.id = auth.uid()::uuid
        AND sau.role = 'super_admin'
        AND sau.status = 'active'
    )
);

-- Subscription Plans (public read for pricing, admin write)
CREATE POLICY "Anyone can view active subscription plans"
ON public.subscription_plans FOR SELECT
USING (active = true);

CREATE POLICY "Super admins can manage subscription plans"
ON public.subscription_plans FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.super_admin_users sau
        WHERE sau.id = auth.uid()::uuid
        AND sau.status = 'active'
    )
);

-- Invoices (tenants can view their own, super admin can view all)
CREATE POLICY "Tenants can view their own invoices"
ON public.invoices FOR SELECT
USING (
    tenant_id IN (
        SELECT t.id FROM public.tenants t
        JOIN public.tenant_users tu ON tu.tenant_id = t.id
        WHERE tu.id = auth.uid()::uuid
    )
);

CREATE POLICY "Super admins can view all invoices"
ON public.invoices FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.super_admin_users sau
        WHERE sau.id = auth.uid()::uuid
        AND sau.status = 'active'
    )
);

-- Payments (same as invoices)
CREATE POLICY "Tenants can view their own payments"
ON public.payments FOR SELECT
USING (
    tenant_id IN (
        SELECT t.id FROM public.tenants t
        JOIN public.tenant_users tu ON tu.tenant_id = t.id
        WHERE tu.id = auth.uid()::uuid
    )
);

CREATE POLICY "Super admins can view all payments"
ON public.payments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.super_admin_users sau
        WHERE sau.id = auth.uid()::uuid
        AND sau.status = 'active'
    )
);

-- Tenant Features (tenants can view their own, super admin can manage)
CREATE POLICY "Tenants can view their own features"
ON public.tenant_features FOR SELECT
USING (
    tenant_id IN (
        SELECT t.id FROM public.tenants t
        JOIN public.tenant_users tu ON tu.tenant_id = t.id
        WHERE tu.id = auth.uid()::uuid
    )
);

CREATE POLICY "Super admins can manage tenant features"
ON public.tenant_features FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.super_admin_users sau
        WHERE sau.id = auth.uid()::uuid
        AND sau.status = 'active'
    )
);

-- Tenant Admin Sessions (users can only see their own)
CREATE POLICY "Tenant admins can view their own sessions"
ON public.tenant_admin_sessions FOR SELECT
USING (tenant_admin_id = auth.uid()::uuid);

-- Tenant Admin Activity (tenant admins can view their tenant's activity)
CREATE POLICY "Tenant admins can view their tenant activity"
ON public.tenant_admin_activity FOR SELECT
USING (
    tenant_id IN (
        SELECT tu.tenant_id FROM public.tenant_users tu
        WHERE tu.id = auth.uid()::uuid
    )
);

-- Customer Users (customers can view their own, tenant admins can view their tenants')
CREATE POLICY "Customers can view their own profile"
ON public.customer_users FOR SELECT
USING (id = auth.uid()::uuid);

CREATE POLICY "Tenant admins can view their tenant's customers"
ON public.customer_users FOR SELECT
USING (
    tenant_id IN (
        SELECT tu.tenant_id FROM public.tenant_users tu
        WHERE tu.id = auth.uid()::uuid
    )
);

-- Customer Sessions (users can only see their own)
CREATE POLICY "Customers can view their own sessions"
ON public.customer_sessions FOR SELECT
USING (customer_user_id = auth.uid()::uuid);

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, display_name, description, price_monthly, price_yearly, limits, features)
VALUES
    ('starter', 'Starter', 'Perfect for small businesses getting started', 99.00, 990.00,
     '{"customers_max": 50, "menus_max": 3, "products_max": 100, "team_members_max": 3, "storage_mb_max": 1024, "api_calls_per_month": 5000}'::jsonb,
     '["basic_menus", "product_management"]'::jsonb),
    ('professional', 'Professional', 'For growing wholesale operations', 299.00, 2990.00,
     '{"customers_max": 500, "menus_max": -1, "products_max": -1, "team_members_max": 10, "storage_mb_max": 51200, "api_calls_per_month": 10000}'::jsonb,
     '["disposable_menus", "custom_branding", "api_access", "advanced_analytics"]'::jsonb),
    ('enterprise', 'Enterprise', 'Full platform access with white-label and SSO', 799.00, 7990.00,
     '{"customers_max": -1, "menus_max": -1, "products_max": -1, "team_members_max": -1, "storage_mb_max": -1, "api_calls_per_month": 50000}'::jsonb,
     '["disposable_menus", "custom_branding", "api_access", "advanced_analytics", "white_label", "sso_saml", "priority_support"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.super_admin_users IS 'Platform owner and team accounts - completely separate from tenant admins';
COMMENT ON TABLE public.super_admin_sessions IS 'JWT session tracking for super admin users';
COMMENT ON TABLE public.super_admin_actions IS 'Audit log for all super admin actions (tenant management, billing, etc.)';
COMMENT ON TABLE public.subscription_plans IS 'Subscription plan definitions with features and limits';
COMMENT ON TABLE public.invoices IS 'Invoices for all tenants - managed by super admin';
COMMENT ON TABLE public.payments IS 'Payment records for all tenants - managed by super admin';
COMMENT ON TABLE public.tenant_features IS 'Feature toggles per tenant - super admin can grant custom features';
COMMENT ON TABLE public.tenant_admin_sessions IS 'JWT session tracking for tenant admin users';
COMMENT ON TABLE public.tenant_admin_activity IS 'Activity audit log for tenant admin actions';
COMMENT ON TABLE public.customer_users IS 'Customer portal accounts - separate from customer records, linked via customer_id';
COMMENT ON TABLE public.customer_sessions IS 'JWT session tracking for customer portal users';


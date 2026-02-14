-- ============================================================================
-- ENSURE TENANTS AND TENANT_USERS TABLES EXIST
-- ============================================================================
-- This migration ensures the core multi-tenant tables exist with proper schema
-- Fixes CreateTenantDialog import errors caused by missing tables
-- ============================================================================

-- ============================================================================
-- TENANTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Business Information
  business_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_email TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT,
  state TEXT,
  
  -- Subscription
  subscription_plan TEXT NOT NULL DEFAULT 'starter' 
    CHECK (subscription_plan IN ('starter', 'professional', 'enterprise')),
  subscription_status TEXT NOT NULL DEFAULT 'trial' 
    CHECK (subscription_status IN ('trial', 'trialing', 'active', 'past_due', 'cancelled', 'suspended')),
  trial_ends_at TIMESTAMPTZ,
  mrr NUMERIC(10,2) DEFAULT 0,
  
  -- Limits and Usage
  limits JSONB DEFAULT '{
    "customers": 50,
    "menus": 5,
    "products": 100,
    "locations": 3,
    "team_members": 3,
    "storage_gb": 5,
    "api_calls": 10000,
    "sms": 100,
    "emails": 500
  }'::jsonb,
  
  features JSONB DEFAULT '{}'::jsonb,
  usage JSONB DEFAULT '{
    "customers": 0,
    "menus": 0,
    "products": 0,
    "locations": 0,
    "team_members": 0,
    "storage_gb": 0,
    "api_calls": 0,
    "sms": 0,
    "emails": 0
  }'::jsonb,
  
  -- Compliance & Status
  compliance_verified BOOLEAN DEFAULT false,
  onboarded BOOLEAN DEFAULT false,
  last_activity_at TIMESTAMPTZ,
  
  -- White-label Settings
  white_label JSONB DEFAULT '{
    "enabled": false,
    "domain": null,
    "logo": null,
    "favicon": null,
    "theme": {}
  }'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Super admins can manage all tenants" ON public.tenants;
DROP POLICY IF EXISTS "Tenants can view own data" ON public.tenants;
DROP POLICY IF EXISTS "tenant_isolation_tenants" ON public.tenants;

-- Policy for super admins to manage all tenants
CREATE POLICY "Super admins can manage all tenants"
  ON public.tenants
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.super_admin_users
      WHERE id = auth.uid()::uuid
      AND status = 'active'
    )
  );

-- Policy for tenants to view their own data (for tenant admins)
CREATE POLICY "Tenants can view own data"
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(subscription_status);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_email ON public.tenants(owner_email);
CREATE INDEX IF NOT EXISTS idx_tenants_subscription_plan ON public.tenants(subscription_plan);

-- ============================================================================
-- TENANT_USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- User Information
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  
  -- Role & Status
  role TEXT NOT NULL DEFAULT 'member' 
    CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'active', 'suspended', 'deleted')),
  
  -- Verification
  email_verified BOOLEAN DEFAULT false,
  
  -- Invitation Tracking
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(tenant_id, email)
);

-- Enable RLS
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Super admins can manage all tenant users" ON public.tenant_users;
DROP POLICY IF EXISTS "Tenant owners can manage their users" ON public.tenant_users;
DROP POLICY IF EXISTS "Users can view own tenant membership" ON public.tenant_users;
DROP POLICY IF EXISTS "tenant_isolation_tenant_users" ON public.tenant_users;

-- Super admins can manage all tenant users
CREATE POLICY "Super admins can manage all tenant users"
  ON public.tenant_users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.super_admin_users
      WHERE id = auth.uid()::uuid
      AND status = 'active'
    )
  );

-- Tenant owners and admins can manage users in their tenant
CREATE POLICY "Tenant owners can manage their users"
  ON public.tenant_users
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
    )
  );

-- Users can view their own tenant membership
CREATE POLICY "Users can view own tenant membership"
  ON public.tenant_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON public.tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON public.tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON public.tenant_users(email);
CREATE INDEX IF NOT EXISTS idx_tenant_users_role ON public.tenant_users(role);
CREATE INDEX IF NOT EXISTS idx_tenant_users_status ON public.tenant_users(status);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for tenants table
DROP TRIGGER IF EXISTS update_tenants_timestamp ON public.tenants;
CREATE TRIGGER update_tenants_timestamp
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for tenant_users table
DROP TRIGGER IF EXISTS update_tenant_users_timestamp ON public.tenant_users;
CREATE TRIGGER update_tenant_users_timestamp
  BEFORE UPDATE ON public.tenant_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.tenants IS 'Multi-tenant SaaS platform tenant accounts';
COMMENT ON COLUMN public.tenants.slug IS 'URL-friendly identifier for tenant (used in routes)';
COMMENT ON COLUMN public.tenants.limits IS 'JSON object with plan limits: {customers: 50, menus: 5, ...}';
COMMENT ON COLUMN public.tenants.usage IS 'JSON object with current usage: {customers: 10, menus: 2, ...}';
COMMENT ON COLUMN public.tenants.features IS 'JSON object with enabled features: {sms: true, api: true, ...}';

COMMENT ON TABLE public.tenant_users IS 'Users belonging to tenant accounts';
COMMENT ON COLUMN public.tenant_users.role IS 'User role within tenant: owner, admin, member, viewer';
COMMENT ON COLUMN public.tenant_users.status IS 'User status: pending (invited), active, suspended, deleted';


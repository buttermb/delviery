-- ============================================================================
-- ENSURE ALL REQUIRED TABLES EXIST
-- ============================================================================
-- Verify invoices and super_admin_actions tables exist
-- Add IF NOT EXISTS guards for safety
-- ============================================================================

-- ============================================================================
-- SUPER_ADMIN_ACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.super_admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    super_admin_id UUID REFERENCES public.super_admin_users(id) ON DELETE SET NULL,
    
    action_type VARCHAR(50) NOT NULL, -- 'tenant_suspended', 'plan_changed', 'refund_issued', 'feature_granted'
    target_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    
    action_data JSONB DEFAULT '{}'::jsonb,
    reason TEXT,
    
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_super_admin_actions_admin ON public.super_admin_actions(super_admin_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_actions_type ON public.super_admin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_super_admin_actions_tenant ON public.super_admin_actions(target_tenant_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_actions_created ON public.super_admin_actions(created_at DESC);

-- RLS (if not already enabled)
ALTER TABLE public.super_admin_actions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Super admins can view all actions" ON public.super_admin_actions;
DROP POLICY IF EXISTS "System can insert super admin actions" ON public.super_admin_actions;

-- Super admins can view all actions
CREATE POLICY "Super admins can view all actions"
    ON public.super_admin_actions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.super_admin_users
            WHERE super_admin_users.id = auth.uid()::uuid
            AND super_admin_users.status = 'active'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.role = 'super_admin'
            AND admin_users.is_active = true
        )
    );

-- System can insert actions (for audit logging)
CREATE POLICY "System can insert super admin actions"
    ON public.super_admin_actions
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON public.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON public.invoices(issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_id ON public.invoices(stripe_invoice_id);

-- RLS (if not already enabled)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Tenants can view their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Super admins can view all invoices" ON public.invoices;

-- Tenants can view their own invoices
CREATE POLICY "Tenants can view their own invoices"
    ON public.invoices
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users
            WHERE tenant_users.user_id = auth.uid()
            AND tenant_users.status = 'active'
        )
        OR
        tenant_id IN (
            SELECT id FROM public.tenants
            WHERE tenants.owner_id = auth.uid()
        )
    );

-- Super admins can view all invoices
CREATE POLICY "Super admins can view all invoices"
    ON public.invoices
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.super_admin_users
            WHERE super_admin_users.id = auth.uid()::uuid
            AND super_admin_users.status = 'active'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.role = 'super_admin'
            AND admin_users.is_active = true
        )
    );

-- Updated_at trigger
CREATE TRIGGER update_invoices_updated_at 
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();


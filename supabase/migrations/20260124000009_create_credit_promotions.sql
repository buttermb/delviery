-- ============================================================================
-- CREDIT PROMOTIONS TABLE
-- Promotional codes for credit-based discounts (percentage, fixed, multiplier)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.credit_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_credits', 'multiplier')),
  value INTEGER NOT NULL,
  min_purchase_credits INTEGER,
  max_discount_credits INTEGER,
  usage_limit INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0,
  per_user_limit INTEGER NOT NULL DEFAULT 1,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one code per tenant
  CONSTRAINT credit_promotions_tenant_code_unique UNIQUE (tenant_id, code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credit_promotions_tenant_id ON public.credit_promotions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_promotions_code ON public.credit_promotions(code);
CREATE INDEX IF NOT EXISTS idx_credit_promotions_active ON public.credit_promotions(tenant_id, is_active) WHERE is_active = true;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.credit_promotions ENABLE ROW LEVEL SECURITY;

-- Tenant users can view their own promotions
CREATE POLICY "Tenant users can view own credit promotions"
  ON public.credit_promotions FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.id = auth.uid()
    )
  );

-- Tenant admins/owners can insert promotions
CREATE POLICY "Tenant admins can insert credit promotions"
  ON public.credit_promotions FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.id = auth.uid()
        AND tu.role IN ('admin', 'owner')
    )
  );

-- Tenant admins/owners can update promotions
CREATE POLICY "Tenant admins can update credit promotions"
  ON public.credit_promotions FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.id = auth.uid()
        AND tu.role IN ('admin', 'owner')
    )
  );

-- Tenant admins/owners can delete promotions
CREATE POLICY "Tenant admins can delete credit promotions"
  ON public.credit_promotions FOR DELETE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.id = auth.uid()
        AND tu.role IN ('admin', 'owner')
    )
  );

-- Super admins can manage all promotions
CREATE POLICY "Super admins manage all credit promotions"
  ON public.credit_promotions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admin_users
      WHERE id = auth.uid()
    )
  );

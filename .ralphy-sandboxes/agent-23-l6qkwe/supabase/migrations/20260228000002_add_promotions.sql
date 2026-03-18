-- Migration: Create promotions table for tenant-level promotional codes
-- Epic: floraiq-mxj - Promotions & Discounts

-- Create promotions table
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
  min_order_amount DECIMAL(10,2),
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  applies_to TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'category', 'product')),
  applies_to_ids UUID[] DEFAULT ARRAY[]::UUID[],
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure unique code per tenant
  CONSTRAINT unique_promotion_code_per_tenant UNIQUE (tenant_id, code)
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_promotions_tenant_id ON public.promotions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON public.promotions(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_promotions_is_active ON public.promotions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON public.promotions(start_date, end_date);

-- Enable Row Level Security
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant members can view promotions in their tenant
CREATE POLICY "Tenant members can view promotions"
  ON public.promotions
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- RLS Policy: Tenant admins can insert promotions
CREATE POLICY "Tenant admins can insert promotions"
  ON public.promotions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = promotions.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role IN ('admin', 'owner')
    )
  );

-- RLS Policy: Tenant admins can update promotions
CREATE POLICY "Tenant admins can update promotions"
  ON public.promotions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = promotions.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role IN ('admin', 'owner')
    )
  );

-- RLS Policy: Tenant admins can delete promotions
CREATE POLICY "Tenant admins can delete promotions"
  ON public.promotions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = promotions.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role IN ('admin', 'owner')
    )
  );

-- Add comments
COMMENT ON TABLE public.promotions IS 'Tenant-level promotional codes with discount rules';
COMMENT ON COLUMN public.promotions.code IS 'Promotion code, unique per tenant';
COMMENT ON COLUMN public.promotions.discount_type IS 'Type of discount: percentage or fixed amount';
COMMENT ON COLUMN public.promotions.discount_value IS 'Discount amount (percentage value or fixed currency amount)';
COMMENT ON COLUMN public.promotions.min_order_amount IS 'Minimum order amount required to use this promotion';
COMMENT ON COLUMN public.promotions.applies_to IS 'Scope: all products, specific category, or specific product';
COMMENT ON COLUMN public.promotions.applies_to_ids IS 'Array of category or product UUIDs this promotion targets';

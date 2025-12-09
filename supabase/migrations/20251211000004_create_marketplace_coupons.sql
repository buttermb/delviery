-- Migration: Create Marketplace Coupons Table
-- Description: Adds table for storing storefront discount coupons

CREATE TABLE IF NOT EXISTS public.marketplace_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.marketplace_profiles(id) ON DELETE CASCADE,
  
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  max_discount_amount NUMERIC(10,2), -- Optional cap for percentage discounts
  
  min_order_amount NUMERIC(10,2),
  usage_limit INTEGER,
  used_count INTEGER DEFAULT 0,
  
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(tenant_id, code),
  CHECK (discount_value > 0),
  CHECK (used_count >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_coupons_tenant_id ON public.marketplace_coupons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_coupons_store_id ON public.marketplace_coupons(store_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_coupons_code ON public.marketplace_coupons(code);

-- RLS Policies
ALTER TABLE public.marketplace_coupons ENABLE ROW LEVEL SECURITY;

-- Tenants can manage their own coupons
CREATE POLICY "Tenants can manage own coupons"
  ON public.marketplace_coupons
  USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

-- Public read access for validation (RPC usually handles this, but read might be needed)
-- Actually, stick to RPC for validation to prevent scraping, but tenant admins need read access.
-- The above policy covers read/write for tenant admins.

-- Trigger for updated_at
CREATE TRIGGER update_marketplace_coupons_updated_at
  BEFORE UPDATE ON public.marketplace_coupons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.marketplace_coupons IS 'Storefront discount coupons';

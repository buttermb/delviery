-- Migration: add_loyalty_points
-- Create tenant-aware loyalty_points transaction log table
-- Tracks individual point transactions (earned, redeemed, adjusted, expired)
-- with full audit trail and customer balance tracking

-- Drop existing table if it exists with old structure (non-tenant-aware)
-- Note: The old loyalty_points table was user-based, not tenant/customer based
DROP TABLE IF EXISTS public.loyalty_points CASCADE;

-- Create the new tenant-aware loyalty_points table
CREATE TABLE public.loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  points INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earned', 'redeemed', 'adjusted', 'expired', 'bonus')),
  reference_type TEXT,
  reference_id UUID,
  balance_after INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for common query patterns
CREATE INDEX idx_loyalty_points_tenant_id ON public.loyalty_points(tenant_id);
CREATE INDEX idx_loyalty_points_customer_id ON public.loyalty_points(tenant_id, customer_id);
CREATE INDEX idx_loyalty_points_created_at ON public.loyalty_points(tenant_id, customer_id, created_at DESC);
CREATE INDEX idx_loyalty_points_type ON public.loyalty_points(tenant_id, type);
CREATE INDEX idx_loyalty_points_reference ON public.loyalty_points(reference_type, reference_id) WHERE reference_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Tenant isolation
-- Select: Users can only view loyalty points for their tenant
CREATE POLICY "loyalty_points_tenant_isolation_select"
  ON public.loyalty_points
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- Insert: Users can only insert loyalty points for their tenant
CREATE POLICY "loyalty_points_tenant_isolation_insert"
  ON public.loyalty_points
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- Update: Users can only update loyalty points for their tenant
CREATE POLICY "loyalty_points_tenant_isolation_update"
  ON public.loyalty_points
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- Delete: Users can only delete loyalty points for their tenant
CREATE POLICY "loyalty_points_tenant_isolation_delete"
  ON public.loyalty_points
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- Create loyalty_config table for tenant-specific loyalty program settings
CREATE TABLE IF NOT EXISTS public.loyalty_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  points_per_dollar NUMERIC(10,2) NOT NULL DEFAULT 1,
  points_to_dollar_ratio INTEGER NOT NULL DEFAULT 100,
  signup_bonus_points INTEGER NOT NULL DEFAULT 0,
  referral_bonus_points INTEGER NOT NULL DEFAULT 0,
  birthday_bonus_points INTEGER NOT NULL DEFAULT 0,
  bronze_threshold INTEGER NOT NULL DEFAULT 0,
  silver_threshold INTEGER NOT NULL DEFAULT 500,
  gold_threshold INTEGER NOT NULL DEFAULT 2000,
  platinum_threshold INTEGER NOT NULL DEFAULT 5000,
  bronze_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  silver_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.25,
  gold_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.50,
  platinum_multiplier NUMERIC(3,2) NOT NULL DEFAULT 2.00,
  points_expiration_months INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index for loyalty_config
CREATE INDEX IF NOT EXISTS idx_loyalty_config_tenant_id ON public.loyalty_config(tenant_id);

-- Enable RLS on loyalty_config
ALTER TABLE public.loyalty_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for loyalty_config
CREATE POLICY "loyalty_config_tenant_isolation_select"
  ON public.loyalty_config
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "loyalty_config_tenant_isolation_insert"
  ON public.loyalty_config
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "loyalty_config_tenant_isolation_update"
  ON public.loyalty_config
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "loyalty_config_tenant_isolation_delete"
  ON public.loyalty_config
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- Function to update loyalty_config.updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_loyalty_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on loyalty_config
DROP TRIGGER IF EXISTS trg_loyalty_config_updated_at ON public.loyalty_config;
CREATE TRIGGER trg_loyalty_config_updated_at
  BEFORE UPDATE ON public.loyalty_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_loyalty_config_updated_at();

-- Helper function to get customer's current loyalty balance
CREATE OR REPLACE FUNCTION public.get_customer_loyalty_balance(
  p_tenant_id UUID,
  p_customer_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(points), 0)
  INTO v_balance
  FROM public.loyalty_points
  WHERE tenant_id = p_tenant_id
  AND customer_id = p_customer_id;

  RETURN GREATEST(0, v_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper function to get customer's lifetime earned points
CREATE OR REPLACE FUNCTION public.get_customer_lifetime_points(
  p_tenant_id UUID,
  p_customer_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_lifetime INTEGER;
BEGIN
  SELECT COALESCE(SUM(points), 0)
  INTO v_lifetime
  FROM public.loyalty_points
  WHERE tenant_id = p_tenant_id
  AND customer_id = p_customer_id
  AND type IN ('earned', 'bonus');

  RETURN GREATEST(0, v_lifetime);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Comments for documentation
COMMENT ON TABLE public.loyalty_points IS 'Transaction log for customer loyalty points - tracks all point changes with full audit trail';
COMMENT ON COLUMN public.loyalty_points.tenant_id IS 'Tenant this loyalty transaction belongs to';
COMMENT ON COLUMN public.loyalty_points.customer_id IS 'Customer who received/spent the points';
COMMENT ON COLUMN public.loyalty_points.points IS 'Number of points (positive for earn/bonus, negative for redeem/expire)';
COMMENT ON COLUMN public.loyalty_points.type IS 'Transaction type: earned, redeemed, adjusted, expired, bonus';
COMMENT ON COLUMN public.loyalty_points.reference_type IS 'Type of entity this transaction relates to (e.g., order, referral)';
COMMENT ON COLUMN public.loyalty_points.reference_id IS 'ID of the related entity';
COMMENT ON COLUMN public.loyalty_points.balance_after IS 'Customer point balance after this transaction';
COMMENT ON COLUMN public.loyalty_points.description IS 'Human-readable description of the transaction';
COMMENT ON COLUMN public.loyalty_points.created_by IS 'User who created this transaction (for manual adjustments)';

COMMENT ON TABLE public.loyalty_config IS 'Tenant-specific loyalty program configuration including tier thresholds and multipliers';

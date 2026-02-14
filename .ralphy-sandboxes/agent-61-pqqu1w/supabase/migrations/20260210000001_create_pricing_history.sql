-- Migration: Create pricing_history table for tracking product price changes over time
-- Task 094: Create product pricing history

-- Create pricing_history table
CREATE TABLE IF NOT EXISTS public.pricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Price fields
  wholesale_price_old NUMERIC(10,2),
  wholesale_price_new NUMERIC(10,2),
  retail_price_old NUMERIC(10,2),
  retail_price_new NUMERIC(10,2),
  cost_per_unit_old NUMERIC(10,2),
  cost_per_unit_new NUMERIC(10,2),

  -- Metadata
  change_reason TEXT,
  change_source TEXT DEFAULT 'manual', -- 'manual', 'bulk_update', 'import', 'promotion'

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_pricing_history_product_id ON public.pricing_history(product_id);
CREATE INDEX IF NOT EXISTS idx_pricing_history_tenant_id ON public.pricing_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pricing_history_created_at ON public.pricing_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_history_product_tenant ON public.pricing_history(product_id, tenant_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.pricing_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant users can view their tenant's pricing history
DROP POLICY IF EXISTS "Tenant users can view pricing history" ON public.pricing_history;
CREATE POLICY "Tenant users can view pricing history"
  ON public.pricing_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = pricing_history.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  );

-- RLS Policy: Tenant admins can insert pricing history
DROP POLICY IF EXISTS "Tenant admins can insert pricing history" ON public.pricing_history;
CREATE POLICY "Tenant admins can insert pricing history"
  ON public.pricing_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = pricing_history.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('admin', 'owner', 'manager')
    )
  );

-- Create function to log price changes
CREATE OR REPLACE FUNCTION public.log_price_change(
  p_product_id UUID,
  p_tenant_id UUID,
  p_changed_by UUID,
  p_wholesale_old NUMERIC DEFAULT NULL,
  p_wholesale_new NUMERIC DEFAULT NULL,
  p_retail_old NUMERIC DEFAULT NULL,
  p_retail_new NUMERIC DEFAULT NULL,
  p_cost_old NUMERIC DEFAULT NULL,
  p_cost_new NUMERIC DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'manual'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_history_id UUID;
BEGIN
  -- Only insert if at least one price actually changed
  IF (p_wholesale_old IS DISTINCT FROM p_wholesale_new)
     OR (p_retail_old IS DISTINCT FROM p_retail_new)
     OR (p_cost_old IS DISTINCT FROM p_cost_new)
  THEN
    INSERT INTO public.pricing_history (
      product_id,
      tenant_id,
      changed_by,
      wholesale_price_old,
      wholesale_price_new,
      retail_price_old,
      retail_price_new,
      cost_per_unit_old,
      cost_per_unit_new,
      change_reason,
      change_source,
      created_at
    )
    VALUES (
      p_product_id,
      p_tenant_id,
      p_changed_by,
      p_wholesale_old,
      p_wholesale_new,
      p_retail_old,
      p_retail_new,
      p_cost_old,
      p_cost_new,
      p_reason,
      p_source,
      NOW()
    )
    RETURNING id INTO v_history_id;

    RETURN v_history_id;
  END IF;

  RETURN NULL;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.log_price_change(UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_price_change(UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) TO service_role;

-- Create function to get most recent price change for a product
CREATE OR REPLACE FUNCTION public.get_recent_price_change(
  p_product_id UUID,
  p_tenant_id UUID,
  p_within_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  id UUID,
  wholesale_price_old NUMERIC,
  wholesale_price_new NUMERIC,
  retail_price_old NUMERIC,
  retail_price_new NUMERIC,
  changed_at TIMESTAMPTZ,
  change_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ph.id,
    ph.wholesale_price_old,
    ph.wholesale_price_new,
    ph.retail_price_old,
    ph.retail_price_new,
    ph.created_at,
    ph.change_reason
  FROM public.pricing_history ph
  WHERE ph.product_id = p_product_id
    AND ph.tenant_id = p_tenant_id
    AND ph.created_at >= (NOW() - (p_within_days || ' days')::INTERVAL)
  ORDER BY ph.created_at DESC
  LIMIT 1;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_recent_price_change(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_price_change(UUID, UUID, INTEGER) TO service_role;

-- Add comments
COMMENT ON TABLE public.pricing_history IS 'Tracks product price changes over time for audit and display purposes';
COMMENT ON COLUMN public.pricing_history.change_source IS 'Source of price change: manual, bulk_update, import, promotion';
COMMENT ON FUNCTION public.log_price_change IS 'Records a price change to pricing_history if values actually changed';
COMMENT ON FUNCTION public.get_recent_price_change IS 'Gets most recent price change within specified days for strikethrough display';

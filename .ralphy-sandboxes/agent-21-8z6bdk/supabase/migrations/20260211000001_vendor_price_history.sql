-- Migration: Add vendor_id to pricing_history for vendor-specific price tracking
-- Task 167: Create vendor product price history

-- Add vendor_id column to existing pricing_history table
ALTER TABLE public.pricing_history
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;

-- Create index for vendor-based queries
CREATE INDEX IF NOT EXISTS idx_pricing_history_vendor_id
  ON public.pricing_history(vendor_id);
CREATE INDEX IF NOT EXISTS idx_pricing_history_vendor_product
  ON public.pricing_history(vendor_id, product_id, created_at DESC);

-- Create a dedicated table for tracking vendor price alerts/thresholds
CREATE TABLE IF NOT EXISTS public.vendor_price_alert_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  alert_threshold_percent NUMERIC(5,2) DEFAULT 10.00, -- Alert when price increases by this %
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_vendor_product_alert UNIQUE (tenant_id, vendor_id, product_id)
);

-- Enable RLS on vendor_price_alert_settings
ALTER TABLE public.vendor_price_alert_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant users can view their alert settings
DROP POLICY IF EXISTS "Tenant users can view vendor price alerts" ON public.vendor_price_alert_settings;
CREATE POLICY "Tenant users can view vendor price alerts"
  ON public.vendor_price_alert_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = vendor_price_alert_settings.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  );

-- RLS Policy: Tenant admins can manage alert settings
DROP POLICY IF EXISTS "Tenant admins can manage vendor price alerts" ON public.vendor_price_alert_settings;
CREATE POLICY "Tenant admins can manage vendor price alerts"
  ON public.vendor_price_alert_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = vendor_price_alert_settings.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('admin', 'owner', 'manager')
    )
  );

-- Create table for storing triggered price alerts
CREATE TABLE IF NOT EXISTS public.vendor_price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  pricing_history_id UUID REFERENCES public.pricing_history(id) ON DELETE SET NULL,
  cost_old NUMERIC(10,2) NOT NULL,
  cost_new NUMERIC(10,2) NOT NULL,
  change_percent NUMERIC(5,2) NOT NULL,
  is_dismissed BOOLEAN DEFAULT false,
  dismissed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on vendor_price_alerts
ALTER TABLE public.vendor_price_alerts ENABLE ROW LEVEL SECURITY;

-- Create indexes for vendor_price_alerts
CREATE INDEX IF NOT EXISTS idx_vendor_price_alerts_tenant
  ON public.vendor_price_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_price_alerts_vendor
  ON public.vendor_price_alerts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_price_alerts_active
  ON public.vendor_price_alerts(tenant_id, is_dismissed) WHERE is_dismissed = false;

-- RLS Policy: Tenant users can view price alerts
DROP POLICY IF EXISTS "Tenant users can view price alerts" ON public.vendor_price_alerts;
CREATE POLICY "Tenant users can view price alerts"
  ON public.vendor_price_alerts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = vendor_price_alerts.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  );

-- RLS Policy: Tenant admins can manage price alerts
DROP POLICY IF EXISTS "Tenant admins can manage price alerts" ON public.vendor_price_alerts;
CREATE POLICY "Tenant admins can manage price alerts"
  ON public.vendor_price_alerts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = vendor_price_alerts.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('admin', 'owner', 'manager')
    )
  );

-- Function to log vendor cost price change and check for alerts
CREATE OR REPLACE FUNCTION public.log_vendor_price_change(
  p_product_id UUID,
  p_tenant_id UUID,
  p_vendor_id UUID,
  p_cost_old NUMERIC,
  p_cost_new NUMERIC,
  p_changed_by UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'purchase_order'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_history_id UUID;
  v_change_percent NUMERIC;
  v_alert_threshold NUMERIC;
BEGIN
  -- Only proceed if cost actually changed
  IF p_cost_old IS NOT DISTINCT FROM p_cost_new THEN
    RETURN NULL;
  END IF;

  -- Insert into pricing_history
  INSERT INTO public.pricing_history (
    product_id,
    tenant_id,
    vendor_id,
    changed_by,
    cost_per_unit_old,
    cost_per_unit_new,
    change_reason,
    change_source,
    created_at
  )
  VALUES (
    p_product_id,
    p_tenant_id,
    p_vendor_id,
    p_changed_by,
    p_cost_old,
    p_cost_new,
    p_reason,
    p_source,
    NOW()
  )
  RETURNING id INTO v_history_id;

  -- Calculate change percentage (only if old cost > 0)
  IF p_cost_old > 0 THEN
    v_change_percent := ((p_cost_new - p_cost_old) / p_cost_old) * 100;

    -- Check if this exceeds alert threshold (only for price increases)
    IF v_change_percent > 0 THEN
      -- Get alert threshold (check product-specific first, then vendor-level, then default 10%)
      SELECT COALESCE(
        (SELECT alert_threshold_percent FROM public.vendor_price_alert_settings
         WHERE tenant_id = p_tenant_id AND vendor_id = p_vendor_id AND product_id = p_product_id AND is_enabled = true
         LIMIT 1),
        (SELECT alert_threshold_percent FROM public.vendor_price_alert_settings
         WHERE tenant_id = p_tenant_id AND vendor_id = p_vendor_id AND product_id IS NULL AND is_enabled = true
         LIMIT 1),
        10.00
      ) INTO v_alert_threshold;

      -- Create alert if threshold exceeded
      IF v_change_percent >= v_alert_threshold THEN
        INSERT INTO public.vendor_price_alerts (
          tenant_id,
          vendor_id,
          product_id,
          pricing_history_id,
          cost_old,
          cost_new,
          change_percent
        )
        VALUES (
          p_tenant_id,
          p_vendor_id,
          p_product_id,
          v_history_id,
          p_cost_old,
          p_cost_new,
          v_change_percent
        );
      END IF;
    END IF;
  END IF;

  RETURN v_history_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.log_vendor_price_change(UUID, UUID, UUID, NUMERIC, NUMERIC, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_vendor_price_change(UUID, UUID, UUID, NUMERIC, NUMERIC, UUID, TEXT, TEXT) TO service_role;

-- Function to get vendor price history for a product
CREATE OR REPLACE FUNCTION public.get_vendor_price_history(
  p_tenant_id UUID,
  p_vendor_id UUID,
  p_product_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  product_id UUID,
  product_name TEXT,
  cost_old NUMERIC,
  cost_new NUMERIC,
  change_percent NUMERIC,
  change_reason TEXT,
  change_source TEXT,
  changed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ph.id,
    ph.product_id,
    p.name::TEXT AS product_name,
    ph.cost_per_unit_old,
    ph.cost_per_unit_new,
    CASE
      WHEN ph.cost_per_unit_old > 0
      THEN ROUND(((ph.cost_per_unit_new - ph.cost_per_unit_old) / ph.cost_per_unit_old) * 100, 2)
      ELSE 0
    END AS change_percent,
    ph.change_reason,
    ph.change_source,
    ph.created_at
  FROM public.pricing_history ph
  JOIN public.products p ON p.id = ph.product_id
  WHERE ph.tenant_id = p_tenant_id
    AND ph.vendor_id = p_vendor_id
    AND (p_product_id IS NULL OR ph.product_id = p_product_id)
    AND ph.cost_per_unit_old IS NOT NULL
    AND ph.cost_per_unit_new IS NOT NULL
  ORDER BY ph.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_vendor_price_history(UUID, UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vendor_price_history(UUID, UUID, UUID, INTEGER) TO service_role;

-- Add comments
COMMENT ON COLUMN public.pricing_history.vendor_id IS 'Optional vendor reference for tracking vendor-specific cost changes';
COMMENT ON TABLE public.vendor_price_alert_settings IS 'Configuration for price increase alert thresholds per vendor/product';
COMMENT ON TABLE public.vendor_price_alerts IS 'Triggered alerts when vendor prices exceed configured thresholds';
COMMENT ON FUNCTION public.log_vendor_price_change IS 'Records vendor cost changes and creates alerts when threshold exceeded';
COMMENT ON FUNCTION public.get_vendor_price_history IS 'Retrieves vendor cost price history for trend analysis';

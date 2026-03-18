-- ============================================================================
-- STOCK ALERTS INTEGRATION
-- Connects Inventory to Stock Alerts - creates alerts when stock falls below threshold
-- ============================================================================

-- 1. Create stock_alerts table if not exists
CREATE TABLE IF NOT EXISTS public.stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  current_quantity NUMERIC NOT NULL DEFAULT 0,
  threshold NUMERIC NOT NULL DEFAULT 10,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')) DEFAULT 'warning',
  status TEXT NOT NULL CHECK (status IN ('active', 'acknowledged', 'resolved')) DEFAULT 'active',
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies with tenant isolation
DROP POLICY IF EXISTS "stock_alerts_tenant_isolation" ON public.stock_alerts;
CREATE POLICY "stock_alerts_tenant_isolation" ON public.stock_alerts
  FOR ALL
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_stock_alerts_tenant_id ON public.stock_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product_id ON public.stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_status ON public.stock_alerts(status);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_severity ON public.stock_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_tenant_status ON public.stock_alerts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_created_at ON public.stock_alerts(created_at DESC);

-- 5. Unique constraint to prevent duplicate active alerts for same product
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_alerts_unique_active
  ON public.stock_alerts(tenant_id, product_id)
  WHERE status = 'active';

-- 6. Function to check and create/update stock alerts
CREATE OR REPLACE FUNCTION public.check_and_create_stock_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold NUMERIC;
  v_severity TEXT;
  v_existing_alert_id UUID;
BEGIN
  -- Get the low stock threshold (default to 10 if not set)
  v_threshold := COALESCE(NEW.low_stock_alert, 10);

  -- Get current quantity (prefer available_quantity, fallback to stock_quantity)
  -- Note: available_quantity may be NUMERIC, so handle accordingly

  -- Check if stock is below threshold
  IF COALESCE(NEW.available_quantity, NEW.stock_quantity, 0) <= v_threshold THEN
    -- Determine severity based on how low the stock is
    IF COALESCE(NEW.available_quantity, NEW.stock_quantity, 0) <= 0 THEN
      v_severity := 'critical';
    ELSIF COALESCE(NEW.available_quantity, NEW.stock_quantity, 0) <= v_threshold * 0.5 THEN
      v_severity := 'critical';
    ELSE
      v_severity := 'warning';
    END IF;

    -- Check if there's already an active alert for this product
    SELECT id INTO v_existing_alert_id
    FROM stock_alerts
    WHERE product_id = NEW.id
      AND tenant_id = NEW.tenant_id
      AND status = 'active'
    LIMIT 1;

    IF v_existing_alert_id IS NOT NULL THEN
      -- Update existing alert with new quantity and severity
      UPDATE stock_alerts
      SET
        current_quantity = COALESCE(NEW.available_quantity, NEW.stock_quantity, 0),
        severity = v_severity,
        threshold = v_threshold,
        updated_at = now()
      WHERE id = v_existing_alert_id;
    ELSE
      -- Create new alert
      INSERT INTO stock_alerts (
        tenant_id,
        product_id,
        product_name,
        current_quantity,
        threshold,
        severity,
        status,
        created_at
      ) VALUES (
        NEW.tenant_id,
        NEW.id,
        COALESCE(NEW.name, 'Unknown Product'),
        COALESCE(NEW.available_quantity, NEW.stock_quantity, 0),
        v_threshold,
        v_severity,
        'active',
        now()
      );
    END IF;
  ELSE
    -- Stock is above threshold - resolve any active alerts
    UPDATE stock_alerts
    SET
      status = 'resolved',
      resolved_at = now(),
      current_quantity = COALESCE(NEW.available_quantity, NEW.stock_quantity, 0),
      updated_at = now()
    WHERE product_id = NEW.id
      AND tenant_id = NEW.tenant_id
      AND status = 'active';
  END IF;

  RETURN NEW;
END;
$$;

-- 7. Create trigger on products table for stock changes
DROP TRIGGER IF EXISTS trigger_check_stock_alert ON public.products;
CREATE TRIGGER trigger_check_stock_alert
  AFTER INSERT OR UPDATE OF available_quantity, stock_quantity, low_stock_alert
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.check_and_create_stock_alert();

-- 8. Function to acknowledge an alert
CREATE OR REPLACE FUNCTION public.acknowledge_stock_alert(
  p_alert_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Update alert status
  UPDATE stock_alerts
  SET
    status = 'acknowledged',
    acknowledged_by = auth.uid(),
    acknowledged_at = now(),
    updated_at = now()
  WHERE id = p_alert_id
    AND tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  RETURNING json_build_object(
    'id', id,
    'status', status,
    'acknowledged_at', acknowledged_at
  ) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Alert not found or access denied';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acknowledge_stock_alert(UUID) TO authenticated;

-- 9. Function to get active stock alerts for a tenant
CREATE OR REPLACE FUNCTION public.get_active_stock_alerts(
  p_tenant_id UUID
)
RETURNS SETOF stock_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has access to tenant
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT *
  FROM stock_alerts
  WHERE tenant_id = p_tenant_id
    AND status = 'active'
  ORDER BY
    CASE severity
      WHEN 'critical' THEN 1
      WHEN 'warning' THEN 2
      ELSE 3
    END,
    created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_stock_alerts(UUID) TO authenticated;

-- 10. Initialize alerts for existing low-stock products
-- This runs once to create alerts for products already below threshold
DO $$
DECLARE
  v_product RECORD;
  v_threshold NUMERIC;
  v_severity TEXT;
BEGIN
  FOR v_product IN
    SELECT
      id,
      tenant_id,
      name,
      COALESCE(available_quantity, stock_quantity, 0) as qty,
      COALESCE(low_stock_alert, 10) as threshold
    FROM products
    WHERE tenant_id IS NOT NULL
      AND COALESCE(available_quantity, stock_quantity, 0) <= COALESCE(low_stock_alert, 10)
  LOOP
    -- Determine severity
    IF v_product.qty <= 0 THEN
      v_severity := 'critical';
    ELSIF v_product.qty <= v_product.threshold * 0.5 THEN
      v_severity := 'critical';
    ELSE
      v_severity := 'warning';
    END IF;

    -- Insert alert if not exists
    INSERT INTO stock_alerts (
      tenant_id,
      product_id,
      product_name,
      current_quantity,
      threshold,
      severity,
      status,
      created_at
    ) VALUES (
      v_product.tenant_id,
      v_product.id,
      COALESCE(v_product.name, 'Unknown Product'),
      v_product.qty,
      v_product.threshold,
      v_severity,
      'active',
      now()
    )
    ON CONFLICT (tenant_id, product_id) WHERE status = 'active'
    DO UPDATE SET
      current_quantity = EXCLUDED.current_quantity,
      severity = EXCLUDED.severity,
      updated_at = now();
  END LOOP;
END $$;

-- 11. Add comments for documentation
COMMENT ON TABLE public.stock_alerts IS 'Stock alerts triggered when product inventory falls below threshold';
COMMENT ON COLUMN public.stock_alerts.severity IS 'Alert severity: critical (<=0 or <=50% threshold), warning (below threshold)';
COMMENT ON COLUMN public.stock_alerts.status IS 'Alert lifecycle: active, acknowledged, resolved';
COMMENT ON FUNCTION public.check_and_create_stock_alert() IS 'Trigger function that creates/updates stock alerts when inventory changes';
COMMENT ON FUNCTION public.acknowledge_stock_alert(UUID) IS 'Acknowledge a stock alert without resolving it';
COMMENT ON FUNCTION public.get_active_stock_alerts(UUID) IS 'Get all active stock alerts for a tenant, sorted by severity';

-- Menu Product Availability Rules Table
-- Defines rules that control when menu products are available to customers

-- Create enum for rule types
DO $$ BEGIN
  CREATE TYPE menu_product_rule_type AS ENUM (
    'time_window',      -- Available only during specific hours
    'day_of_week',      -- Available only on certain days
    'quantity_limit',   -- Limited quantity per menu session
    'bundle_only'       -- Only available as part of a bundle
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create the availability rules table
CREATE TABLE IF NOT EXISTS menu_product_availability_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES disposable_menus(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES wholesale_inventory(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Rule configuration
  rule_type TEXT NOT NULL CHECK (rule_type IN ('time_window', 'day_of_week', 'quantity_limit', 'bundle_only')),
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Time window rules (start_hour and end_hour in 24h format, e.g., 9 = 9am, 17 = 5pm)
  start_hour INTEGER CHECK (start_hour >= 0 AND start_hour <= 23),
  end_hour INTEGER CHECK (end_hour >= 0 AND end_hour <= 23),

  -- Day of week rules (array of day numbers: 0=Sunday, 1=Monday, ... 6=Saturday)
  allowed_days INTEGER[] CHECK (array_length(allowed_days, 1) IS NULL OR
    (allowed_days <@ ARRAY[0,1,2,3,4,5,6])),

  -- Quantity limit rules
  max_quantity INTEGER CHECK (max_quantity > 0),
  current_quantity_used INTEGER DEFAULT 0,

  -- Bundle-only rules
  bundle_product_ids UUID[],

  -- Display behavior when unavailable
  hide_when_unavailable BOOLEAN DEFAULT false,
  unavailable_message TEXT DEFAULT 'Currently unavailable',

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT unique_menu_product_rule UNIQUE (menu_id, product_id, rule_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_menu_product_availability_rules_menu_id
  ON menu_product_availability_rules(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_product_availability_rules_product_id
  ON menu_product_availability_rules(product_id);
CREATE INDEX IF NOT EXISTS idx_menu_product_availability_rules_tenant_id
  ON menu_product_availability_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_product_availability_rules_active
  ON menu_product_availability_rules(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE menu_product_availability_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant users can view their availability rules"
  ON menu_product_availability_rules
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can manage their availability rules"
  ON menu_product_availability_rules
  FOR ALL
  TO authenticated
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu
    WHERE tu.user_id = auth.uid()
    AND tu.role IN ('admin', 'owner', 'manager')
  ))
  WITH CHECK (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu
    WHERE tu.user_id = auth.uid()
    AND tu.role IN ('admin', 'owner', 'manager')
  ));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_menu_product_availability_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_menu_product_availability_rules_updated_at ON menu_product_availability_rules;
CREATE TRIGGER trg_menu_product_availability_rules_updated_at
  BEFORE UPDATE ON menu_product_availability_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_menu_product_availability_rules_updated_at();

-- Function to evaluate if a product is available based on rules
CREATE OR REPLACE FUNCTION evaluate_menu_product_availability(
  p_menu_id UUID,
  p_product_id UUID,
  p_check_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  is_available BOOLEAN,
  unavailable_reason TEXT,
  hide_product BOOLEAN
) AS $$
DECLARE
  v_rule RECORD;
  v_day_of_week INTEGER;
  v_hour INTEGER;
BEGIN
  -- Default: product is available
  is_available := true;
  unavailable_reason := NULL;
  hide_product := false;

  -- Get current day and hour
  v_day_of_week := EXTRACT(DOW FROM p_check_time)::INTEGER;
  v_hour := EXTRACT(HOUR FROM p_check_time)::INTEGER;

  -- Check all active rules for this product on this menu
  FOR v_rule IN
    SELECT * FROM menu_product_availability_rules
    WHERE menu_id = p_menu_id
      AND product_id = p_product_id
      AND is_active = true
  LOOP
    -- Time window rule
    IF v_rule.rule_type = 'time_window' THEN
      IF v_rule.start_hour IS NOT NULL AND v_rule.end_hour IS NOT NULL THEN
        -- Handle overnight windows (e.g., 22:00 to 06:00)
        IF v_rule.start_hour <= v_rule.end_hour THEN
          IF v_hour < v_rule.start_hour OR v_hour >= v_rule.end_hour THEN
            is_available := false;
            unavailable_reason := COALESCE(v_rule.unavailable_message,
              'Available from ' || v_rule.start_hour || ':00 to ' || v_rule.end_hour || ':00');
            hide_product := v_rule.hide_when_unavailable;
            RETURN NEXT;
            RETURN;
          END IF;
        ELSE
          -- Overnight window
          IF v_hour < v_rule.start_hour AND v_hour >= v_rule.end_hour THEN
            is_available := false;
            unavailable_reason := COALESCE(v_rule.unavailable_message,
              'Available from ' || v_rule.start_hour || ':00 to ' || v_rule.end_hour || ':00');
            hide_product := v_rule.hide_when_unavailable;
            RETURN NEXT;
            RETURN;
          END IF;
        END IF;
      END IF;
    END IF;

    -- Day of week rule
    IF v_rule.rule_type = 'day_of_week' THEN
      IF v_rule.allowed_days IS NOT NULL AND array_length(v_rule.allowed_days, 1) > 0 THEN
        IF NOT (v_day_of_week = ANY(v_rule.allowed_days)) THEN
          is_available := false;
          unavailable_reason := COALESCE(v_rule.unavailable_message, 'Not available today');
          hide_product := v_rule.hide_when_unavailable;
          RETURN NEXT;
          RETURN;
        END IF;
      END IF;
    END IF;

    -- Quantity limit rule
    IF v_rule.rule_type = 'quantity_limit' THEN
      IF v_rule.max_quantity IS NOT NULL THEN
        IF COALESCE(v_rule.current_quantity_used, 0) >= v_rule.max_quantity THEN
          is_available := false;
          unavailable_reason := COALESCE(v_rule.unavailable_message, 'Sold out for this session');
          hide_product := v_rule.hide_when_unavailable;
          RETURN NEXT;
          RETURN;
        END IF;
      END IF;
    END IF;

    -- Bundle-only rule
    IF v_rule.rule_type = 'bundle_only' THEN
      is_available := false;
      unavailable_reason := COALESCE(v_rule.unavailable_message, 'Only available as part of a bundle');
      hide_product := v_rule.hide_when_unavailable;
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION evaluate_menu_product_availability TO authenticated;

COMMENT ON TABLE menu_product_availability_rules IS 'Defines availability rules for products on specific menus';
COMMENT ON FUNCTION evaluate_menu_product_availability IS 'Evaluates all active rules to determine if a product is currently available on a menu';

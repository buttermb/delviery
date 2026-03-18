-- ============================================================================
-- ORDER PRIORITY SYSTEM
-- Adds priority field (low/normal/high/urgent) with auto-priority rules
-- ============================================================================

-- Add priority column to unified_orders
ALTER TABLE unified_orders ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal'
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- Add priority_set_at timestamp to track when priority was set
ALTER TABLE unified_orders ADD COLUMN IF NOT EXISTS priority_set_at timestamptz;

-- Add priority_set_by to track who set the priority
ALTER TABLE unified_orders ADD COLUMN IF NOT EXISTS priority_set_by uuid REFERENCES auth.users(id);

-- Add priority_auto_set to track if priority was auto-assigned
ALTER TABLE unified_orders ADD COLUMN IF NOT EXISTS priority_auto_set boolean DEFAULT false;

-- Create index for efficient querying of priority orders
CREATE INDEX IF NOT EXISTS idx_unified_orders_priority
  ON unified_orders(tenant_id, priority, created_at DESC);

-- Create composite index for priority queue ordering (urgent and high first)
CREATE INDEX IF NOT EXISTS idx_unified_orders_priority_queue
  ON unified_orders(tenant_id,
    CASE priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'low' THEN 4
    END,
    created_at ASC
  ) WHERE status NOT IN ('completed', 'cancelled', 'rejected', 'refunded');

-- Partial index for urgent orders (fast lookup)
CREATE INDEX IF NOT EXISTS idx_unified_orders_urgent
  ON unified_orders(tenant_id, created_at DESC)
  WHERE priority = 'urgent';

-- Partial index for high priority orders
CREATE INDEX IF NOT EXISTS idx_unified_orders_high_priority
  ON unified_orders(tenant_id, created_at DESC)
  WHERE priority IN ('urgent', 'high');

-- Add comments
COMMENT ON COLUMN unified_orders.priority IS 'Order priority level: low, normal, high, urgent';
COMMENT ON COLUMN unified_orders.priority_set_at IS 'Timestamp when priority was set or changed';
COMMENT ON COLUMN unified_orders.priority_set_by IS 'User ID who set the priority';
COMMENT ON COLUMN unified_orders.priority_auto_set IS 'Whether priority was automatically assigned by rules';

-- ============================================================================
-- TENANT PRIORITY SETTINGS
-- Configurable rules for auto-priority assignment
-- ============================================================================

-- Create table for tenant priority settings
CREATE TABLE IF NOT EXISTS tenant_priority_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- VIP customer rules
  vip_customer_priority text DEFAULT 'high' CHECK (vip_customer_priority IN ('normal', 'high', 'urgent')),

  -- Large order rules (threshold in cents/smallest currency unit)
  large_order_threshold numeric DEFAULT 50000, -- $500 default
  large_order_priority text DEFAULT 'high' CHECK (large_order_priority IN ('normal', 'high', 'urgent')),

  -- Wholesale order rules
  wholesale_default_priority text DEFAULT 'normal' CHECK (wholesale_default_priority IN ('low', 'normal', 'high')),

  -- Scheduled delivery rules (orders due within hours)
  urgent_delivery_hours integer DEFAULT 2, -- Orders due in 2 hours get urgent
  urgent_delivery_priority text DEFAULT 'urgent' CHECK (urgent_delivery_priority IN ('high', 'urgent')),

  -- Enable auto-priority
  auto_priority_enabled boolean DEFAULT true,

  -- Notification settings
  notify_on_urgent boolean DEFAULT true,
  notify_on_high boolean DEFAULT false,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT tenant_priority_settings_tenant_unique UNIQUE (tenant_id)
);

-- Enable RLS on tenant_priority_settings
ALTER TABLE tenant_priority_settings ENABLE ROW LEVEL SECURITY;

-- RLS policy for tenant isolation
CREATE POLICY "tenant_priority_settings_tenant_isolation" ON tenant_priority_settings
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  )
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_tenant_priority_settings_tenant
  ON tenant_priority_settings(tenant_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_tenant_priority_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenant_priority_settings_updated_at
  BEFORE UPDATE ON tenant_priority_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_priority_settings_updated_at();

-- ============================================================================
-- AUTO-PRIORITY FUNCTION
-- Calculates priority based on tenant rules
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_order_priority(
  p_tenant_id uuid,
  p_customer_id uuid DEFAULT NULL,
  p_wholesale_client_id uuid DEFAULT NULL,
  p_total_amount numeric DEFAULT 0,
  p_order_type text DEFAULT 'retail',
  p_scheduled_delivery_at timestamptz DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings tenant_priority_settings%ROWTYPE;
  v_priority text := 'normal';
  v_is_vip boolean := false;
  v_hours_until_delivery numeric;
BEGIN
  -- Get tenant settings
  SELECT * INTO v_settings
  FROM tenant_priority_settings
  WHERE tenant_id = p_tenant_id;

  -- If no settings or auto-priority disabled, return normal
  IF v_settings.id IS NULL OR NOT v_settings.auto_priority_enabled THEN
    RETURN 'normal';
  END IF;

  -- Check VIP customer status
  IF p_customer_id IS NOT NULL THEN
    SELECT COALESCE(is_vip, false) INTO v_is_vip
    FROM customers
    WHERE id = p_customer_id;

    IF v_is_vip THEN
      v_priority := v_settings.vip_customer_priority;
    END IF;
  END IF;

  -- Check VIP wholesale client status
  IF p_wholesale_client_id IS NOT NULL THEN
    SELECT COALESCE(is_vip, false) INTO v_is_vip
    FROM wholesale_clients
    WHERE id = p_wholesale_client_id;

    IF v_is_vip THEN
      v_priority := v_settings.vip_customer_priority;
    END IF;
  END IF;

  -- Check large order threshold
  IF p_total_amount >= v_settings.large_order_threshold THEN
    -- Only upgrade if current priority is lower
    IF v_priority = 'normal' OR v_priority = 'low' THEN
      v_priority := v_settings.large_order_priority;
    END IF;
  END IF;

  -- Check wholesale default priority
  IF p_order_type = 'wholesale' AND v_priority = 'normal' THEN
    v_priority := v_settings.wholesale_default_priority;
  END IF;

  -- Check scheduled delivery urgency
  IF p_scheduled_delivery_at IS NOT NULL THEN
    v_hours_until_delivery := EXTRACT(EPOCH FROM (p_scheduled_delivery_at - now())) / 3600;

    IF v_hours_until_delivery > 0 AND v_hours_until_delivery <= v_settings.urgent_delivery_hours THEN
      -- Delivery is due soon - make urgent
      v_priority := v_settings.urgent_delivery_priority;
    END IF;
  END IF;

  RETURN v_priority;
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_order_priority TO authenticated;

-- ============================================================================
-- UPDATE ORDER PRIORITY FUNCTION
-- Updates priority with proper tracking
-- ============================================================================

CREATE OR REPLACE FUNCTION update_order_priority(
  p_order_id uuid,
  p_priority text,
  p_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE unified_orders
  SET
    priority = p_priority,
    priority_set_at = now(),
    priority_set_by = p_user_id,
    priority_auto_set = false
  WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_order_priority TO authenticated;

-- ============================================================================
-- TRIGGER FOR AUTO-PRIORITY ON INSERT
-- ============================================================================

CREATE OR REPLACE FUNCTION set_order_priority_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_priority text;
BEGIN
  -- Only auto-set if priority is not explicitly provided
  IF NEW.priority IS NULL OR NEW.priority = 'normal' THEN
    v_priority := calculate_order_priority(
      NEW.tenant_id,
      NEW.customer_id,
      NEW.wholesale_client_id,
      NEW.total_amount,
      NEW.order_type,
      NEW.scheduled_delivery_at
    );

    NEW.priority := v_priority;
    NEW.priority_auto_set := (v_priority != 'normal');
    IF v_priority != 'normal' THEN
      NEW.priority_set_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS unified_orders_auto_priority ON unified_orders;
CREATE TRIGGER unified_orders_auto_priority
  BEFORE INSERT ON unified_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_priority_on_insert();

-- ============================================================================
-- URGENT ORDER NOTIFICATION TABLE
-- Stores urgent order notifications for admin
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_priority_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES unified_orders(id) ON DELETE CASCADE,
  priority text NOT NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('new_urgent', 'priority_changed', 'delivery_approaching')),
  message text,
  acknowledged boolean DEFAULT false,
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT order_priority_notifications_unique UNIQUE (order_id, notification_type)
);

-- Enable RLS
ALTER TABLE order_priority_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "order_priority_notifications_tenant_isolation" ON order_priority_notifications
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_priority_notifications_tenant
  ON order_priority_notifications(tenant_id, acknowledged, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_priority_notifications_order
  ON order_priority_notifications(order_id);

-- ============================================================================
-- TRIGGER FOR URGENT ORDER NOTIFICATIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION create_urgent_order_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_settings tenant_priority_settings%ROWTYPE;
  v_should_notify boolean := false;
  v_message text;
BEGIN
  -- Get tenant settings
  SELECT * INTO v_settings
  FROM tenant_priority_settings
  WHERE tenant_id = NEW.tenant_id;

  -- Check if we should notify
  IF NEW.priority = 'urgent' AND (v_settings.id IS NULL OR v_settings.notify_on_urgent) THEN
    v_should_notify := true;
    v_message := 'Urgent order ' || NEW.order_number || ' requires immediate attention';
  ELSIF NEW.priority = 'high' AND v_settings.id IS NOT NULL AND v_settings.notify_on_high THEN
    v_should_notify := true;
    v_message := 'High priority order ' || NEW.order_number || ' has been created';
  END IF;

  -- Create notification
  IF v_should_notify THEN
    INSERT INTO order_priority_notifications (
      tenant_id, order_id, priority, notification_type, message
    ) VALUES (
      NEW.tenant_id, NEW.id, NEW.priority, 'new_urgent', v_message
    )
    ON CONFLICT (order_id, notification_type) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS unified_orders_urgent_notification ON unified_orders;
CREATE TRIGGER unified_orders_urgent_notification
  AFTER INSERT ON unified_orders
  FOR EACH ROW
  WHEN (NEW.priority IN ('urgent', 'high'))
  EXECUTE FUNCTION create_urgent_order_notification();

-- Trigger for priority change notifications
CREATE OR REPLACE FUNCTION create_priority_change_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_settings tenant_priority_settings%ROWTYPE;
  v_should_notify boolean := false;
  v_message text;
BEGIN
  -- Only notify on upgrades to urgent or high
  IF NEW.priority != OLD.priority THEN
    SELECT * INTO v_settings
    FROM tenant_priority_settings
    WHERE tenant_id = NEW.tenant_id;

    IF NEW.priority = 'urgent' AND (v_settings.id IS NULL OR v_settings.notify_on_urgent) THEN
      v_should_notify := true;
      v_message := 'Order ' || NEW.order_number || ' priority changed to URGENT';
    ELSIF NEW.priority = 'high' AND v_settings.id IS NOT NULL AND v_settings.notify_on_high THEN
      v_should_notify := true;
      v_message := 'Order ' || NEW.order_number || ' priority changed to HIGH';
    END IF;

    IF v_should_notify THEN
      INSERT INTO order_priority_notifications (
        tenant_id, order_id, priority, notification_type, message
      ) VALUES (
        NEW.tenant_id, NEW.id, NEW.priority, 'priority_changed', v_message
      )
      ON CONFLICT (order_id, notification_type) DO UPDATE
      SET priority = EXCLUDED.priority,
          message = EXCLUDED.message,
          acknowledged = false,
          acknowledged_at = NULL,
          acknowledged_by = NULL,
          created_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS unified_orders_priority_change_notification ON unified_orders;
CREATE TRIGGER unified_orders_priority_change_notification
  AFTER UPDATE OF priority ON unified_orders
  FOR EACH ROW
  EXECUTE FUNCTION create_priority_change_notification();

-- Comments
COMMENT ON TABLE tenant_priority_settings IS 'Tenant-specific settings for order priority rules';
COMMENT ON TABLE order_priority_notifications IS 'Notifications for urgent and high priority orders';
COMMENT ON FUNCTION calculate_order_priority IS 'Calculates order priority based on tenant rules';
COMMENT ON FUNCTION update_order_priority IS 'Updates order priority with tracking';

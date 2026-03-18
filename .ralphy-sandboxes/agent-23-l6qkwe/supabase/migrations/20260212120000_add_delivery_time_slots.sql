-- Create delivery_time_slots table for scheduling deliveries
-- Allows tenants to define available time windows for customer deliveries

CREATE TABLE IF NOT EXISTS delivery_time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 10,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  days_of_week INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}'::integer[],
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT delivery_time_slots_capacity_check CHECK (max_capacity > 0 AND max_capacity <= 100),
  CONSTRAINT delivery_time_slots_time_check CHECK (end_time > start_time),
  CONSTRAINT delivery_time_slots_days_check CHECK (
    array_length(days_of_week, 1) > 0 AND
    days_of_week <@ '{0,1,2,3,4,5,6}'::integer[]
  )
);

-- Add index for efficient tenant queries
CREATE INDEX IF NOT EXISTS idx_delivery_time_slots_tenant
  ON delivery_time_slots(tenant_id);

-- Add index for enabled slots ordered by priority
CREATE INDEX IF NOT EXISTS idx_delivery_time_slots_enabled
  ON delivery_time_slots(tenant_id, is_enabled, priority, start_time)
  WHERE is_enabled = true;

-- Enable RLS
ALTER TABLE delivery_time_slots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant isolation
CREATE POLICY "Tenants can view their own time slots"
  ON delivery_time_slots
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
      AND tu.status = 'active'
    )
  );

CREATE POLICY "Tenants can insert their own time slots"
  ON delivery_time_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
      AND tu.status = 'active'
      AND tu.role IN ('admin', 'owner', 'super_admin', 'manager')
    )
  );

CREATE POLICY "Tenants can update their own time slots"
  ON delivery_time_slots
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
      AND tu.status = 'active'
      AND tu.role IN ('admin', 'owner', 'super_admin', 'manager')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
      AND tu.status = 'active'
      AND tu.role IN ('admin', 'owner', 'super_admin', 'manager')
    )
  );

CREATE POLICY "Tenants can delete their own time slots"
  ON delivery_time_slots
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
      AND tu.status = 'active'
      AND tu.role IN ('admin', 'owner', 'super_admin', 'manager')
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_delivery_time_slots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER delivery_time_slots_updated_at
  BEFORE UPDATE ON delivery_time_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_time_slots_updated_at();

-- Add comment for documentation
COMMENT ON TABLE delivery_time_slots IS 'Delivery time slots configuration for scheduling customer deliveries. Each slot defines a time window with capacity limits.';
COMMENT ON COLUMN delivery_time_slots.days_of_week IS 'Array of day numbers (0=Sunday, 6=Saturday) when this slot is available';
COMMENT ON COLUMN delivery_time_slots.max_capacity IS 'Maximum number of deliveries that can be scheduled in this slot per day';
COMMENT ON COLUMN delivery_time_slots.priority IS 'Display order priority (lower numbers appear first)';

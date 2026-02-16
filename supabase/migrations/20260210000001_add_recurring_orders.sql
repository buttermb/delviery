-- Migration: Create recurring_orders table for subscription/recurring order support
-- Date: 2026-02-10
-- Task: task-076 - Create Supabase migration for recurring_orders table

-- Create recurring_orders table
CREATE TABLE IF NOT EXISTS public.recurring_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  customer_id UUID,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  next_run_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_recurring_orders_tenant ON recurring_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recurring_orders_customer ON recurring_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_recurring_orders_next_run ON recurring_orders(next_run_date);
CREATE INDEX IF NOT EXISTS idx_recurring_orders_active ON recurring_orders(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_orders_template ON recurring_orders(template_order_id);

-- Enable RLS
ALTER TABLE recurring_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can view their own recurring orders
CREATE POLICY "Tenants can view own recurring orders"
ON recurring_orders
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  )
);

-- Policy: Tenants can insert their own recurring orders
CREATE POLICY "Tenants can insert own recurring orders"
ON recurring_orders
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  )
);

-- Policy: Tenants can update their own recurring orders
CREATE POLICY "Tenants can update own recurring orders"
ON recurring_orders
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  )
);

-- Policy: Tenants can delete their own recurring orders
CREATE POLICY "Tenants can delete own recurring orders"
ON recurring_orders
FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  )
);

-- Policy: Super admins can view all recurring orders
CREATE POLICY "Super admins can view all recurring orders"
ON recurring_orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM super_admins WHERE user_id = auth.uid()
  )
);

-- Policy: Super admins can manage all recurring orders
CREATE POLICY "Super admins can manage all recurring orders"
ON recurring_orders
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM super_admins WHERE user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_recurring_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recurring_orders_updated_at ON recurring_orders;
CREATE TRIGGER recurring_orders_updated_at
  BEFORE UPDATE ON recurring_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_orders_updated_at();

-- Add comment for documentation
COMMENT ON TABLE recurring_orders IS 'Stores recurring order templates for automated order creation';
COMMENT ON COLUMN recurring_orders.template_order_id IS 'Reference to the original order used as template';
COMMENT ON COLUMN recurring_orders.frequency IS 'How often the order recurs: daily, weekly, biweekly, or monthly';
COMMENT ON COLUMN recurring_orders.next_run_date IS 'Date when the next order should be automatically created';
COMMENT ON COLUMN recurring_orders.end_date IS 'Optional end date for the recurring schedule';
COMMENT ON COLUMN recurring_orders.is_active IS 'Whether this recurring order is currently active';

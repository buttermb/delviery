-- Migration: Create commission_transactions table and trigger for 2% commission calculation
-- Date: 2025-11-07

-- Create commission_transactions table
CREATE TABLE IF NOT EXISTS commission_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES menu_orders(id) ON DELETE SET NULL,
  customer_payment_amount NUMERIC(10,2) NOT NULL,
  commission_rate NUMERIC(5,2) DEFAULT 2.00,
  commission_amount NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'paid', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_commission_tenant ON commission_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_order ON commission_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_commission_status ON commission_transactions(status);
CREATE INDEX IF NOT EXISTS idx_commission_created ON commission_transactions(created_at);

-- Add RLS policies
ALTER TABLE commission_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can view their own commission transactions
CREATE POLICY "Tenants can view own commission transactions"
ON commission_transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tenants
    WHERE tenants.id = commission_transactions.tenant_id
    AND tenants.id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  )
);

-- Policy: System can insert commission transactions (via trigger)
CREATE POLICY "System can insert commission transactions"
ON commission_transactions
FOR INSERT
WITH CHECK (true);

-- Policy: Super admins can view all commission transactions
CREATE POLICY "Super admins can view all commission transactions"
ON commission_transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email LIKE '%@admin.%'
  )
);

-- Function to calculate commission on order completion
CREATE OR REPLACE FUNCTION calculate_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_total_amount NUMERIC;
BEGIN
  -- Only process when order status changes to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    -- Get tenant_id from the menu
    SELECT dm.tenant_id INTO v_tenant_id
    FROM disposable_menus dm
    WHERE dm.id = NEW.menu_id;
    
    -- Calculate commission (2%)
    v_total_amount := NEW.total_amount;
    
    -- Only insert if tenant_id exists and order amount > 0
    IF v_tenant_id IS NOT NULL AND v_total_amount > 0 THEN
      INSERT INTO commission_transactions (
        tenant_id,
        order_id,
        customer_payment_amount,
        commission_rate,
        commission_amount,
        status,
        created_at
      ) VALUES (
        v_tenant_id,
        NEW.id,
        v_total_amount,
        2.00,
        v_total_amount * 0.02,
        'pending',
        NOW()
      )
      ON CONFLICT DO NOTHING; -- Prevent duplicates
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on menu_orders table
DROP TRIGGER IF EXISTS order_commission_trigger ON menu_orders;
CREATE TRIGGER order_commission_trigger
AFTER UPDATE ON menu_orders
FOR EACH ROW
WHEN (NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed'))
EXECUTE FUNCTION calculate_commission();

-- Also handle inserts if orders can be created directly as confirmed
DROP TRIGGER IF EXISTS order_commission_trigger_insert ON menu_orders;
CREATE TRIGGER order_commission_trigger_insert
AFTER INSERT ON menu_orders
FOR EACH ROW
WHEN (NEW.status = 'confirmed')
EXECUTE FUNCTION calculate_commission();


-- ============================================
-- PURCHASE ORDERS TENANT SUPPORT MIGRATION
-- Adds tenant_id to purchase_orders and purchase_order_items tables
-- with proper RLS policies for multi-tenant isolation
-- ============================================

-- Step 1: Add tenant_id to purchase_orders table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_id ON purchase_orders(tenant_id);
  END IF;
END $$;

-- Step 2: Add additional columns to purchase_orders if not exists
DO $$
BEGIN
  -- Add received_date if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'received_date'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN received_date date;
  END IF;
END $$;

-- Step 3: Add tenant_id to vendors table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE vendors ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_vendors_tenant_id ON vendors(tenant_id);
  END IF;
END $$;

-- Step 4: Backfill tenant_id from accounts for purchase_orders
UPDATE purchase_orders
SET tenant_id = accounts.tenant_id
FROM accounts
WHERE purchase_orders.account_id = accounts.id
AND purchase_orders.tenant_id IS NULL
AND accounts.tenant_id IS NOT NULL;

-- Step 5: Backfill tenant_id from accounts for vendors
UPDATE vendors
SET tenant_id = accounts.tenant_id
FROM accounts
WHERE vendors.account_id = accounts.id
AND vendors.tenant_id IS NULL
AND accounts.tenant_id IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY POLICIES FOR PURCHASE_ORDERS
-- ============================================

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Tenant members can view purchase orders" ON purchase_orders;
DROP POLICY IF EXISTS "Tenant members can insert purchase orders" ON purchase_orders;
DROP POLICY IF EXISTS "Tenant members can update purchase orders" ON purchase_orders;
DROP POLICY IF EXISTS "Tenant members can delete purchase orders" ON purchase_orders;

-- SELECT policy
CREATE POLICY "Tenant members can view purchase orders"
  ON purchase_orders FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- INSERT policy
CREATE POLICY "Tenant members can insert purchase orders"
  ON purchase_orders FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- UPDATE policy
CREATE POLICY "Tenant members can update purchase orders"
  ON purchase_orders FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- DELETE policy
CREATE POLICY "Tenant members can delete purchase orders"
  ON purchase_orders FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- ROW LEVEL SECURITY POLICIES FOR PURCHASE_ORDER_ITEMS
-- ============================================

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Tenant members can view purchase order items" ON purchase_order_items;
DROP POLICY IF EXISTS "Tenant members can insert purchase order items" ON purchase_order_items;
DROP POLICY IF EXISTS "Tenant members can update purchase order items" ON purchase_order_items;
DROP POLICY IF EXISTS "Tenant members can delete purchase order items" ON purchase_order_items;

-- SELECT policy - items are accessed through their purchase_order
CREATE POLICY "Tenant members can view purchase order items"
  ON purchase_order_items FOR SELECT
  USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT policy
CREATE POLICY "Tenant members can insert purchase order items"
  ON purchase_order_items FOR INSERT
  WITH CHECK (
    purchase_order_id IN (
      SELECT id FROM purchase_orders
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
      )
    )
  );

-- UPDATE policy
CREATE POLICY "Tenant members can update purchase order items"
  ON purchase_order_items FOR UPDATE
  USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
      )
    )
  );

-- DELETE policy
CREATE POLICY "Tenant members can delete purchase order items"
  ON purchase_order_items FOR DELETE
  USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================
-- ROW LEVEL SECURITY POLICIES FOR VENDORS
-- ============================================

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Tenant members can view vendors" ON vendors;
DROP POLICY IF EXISTS "Tenant members can insert vendors" ON vendors;
DROP POLICY IF EXISTS "Tenant members can update vendors" ON vendors;
DROP POLICY IF EXISTS "Tenant members can delete vendors" ON vendors;

-- SELECT policy
CREATE POLICY "Tenant members can view vendors"
  ON vendors FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- INSERT policy
CREATE POLICY "Tenant members can insert vendors"
  ON vendors FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- UPDATE policy
CREATE POLICY "Tenant members can update vendors"
  ON vendors FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- DELETE policy
CREATE POLICY "Tenant members can delete vendors"
  ON vendors FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON purchase_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product_id ON purchase_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);

-- ============================================
-- TRIGGER FOR updated_at
-- ============================================

-- Create update_updated_at_column function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers if not exist
DROP TRIGGER IF EXISTS update_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendors_updated_at ON vendors;
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE purchase_orders IS 'Purchase orders from vendors with tenant isolation';
COMMENT ON TABLE purchase_order_items IS 'Line items for purchase orders';
COMMENT ON TABLE vendors IS 'Vendor/supplier management with tenant isolation';

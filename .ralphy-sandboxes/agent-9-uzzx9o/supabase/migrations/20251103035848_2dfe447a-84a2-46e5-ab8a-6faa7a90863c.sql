-- Phase 1: Establish Account-Tenant Relationship and Add Missing tenant_id Columns

-- Step 1: Add tenant_id to accounts table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'accounts' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE accounts ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_accounts_tenant_id ON accounts(tenant_id);
  END IF;
END $$;

-- Step 2: Add tenant_id to orders table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
  END IF;
END $$;

-- Step 3: Add tenant_id to customers table  
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
  END IF;
END $$;

-- Step 4: Add tenant_id to support_tickets table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_id ON support_tickets(tenant_id);
  END IF;
END $$;

-- Step 5: Add tenant_id to products table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE products ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
  END IF;
END $$;

-- Step 6: Backfill tenant_id data where account_id exists
-- Link accounts to tenants (1:1 relationship for now)
UPDATE accounts 
SET tenant_id = accounts.tenant_id
WHERE tenant_id IS NOT NULL;

-- Backfill orders.tenant_id from accounts
UPDATE orders 
SET tenant_id = accounts.tenant_id 
FROM accounts 
WHERE orders.account_id = accounts.id 
AND orders.tenant_id IS NULL
AND accounts.tenant_id IS NOT NULL;

-- Backfill customers.tenant_id from accounts
UPDATE customers 
SET tenant_id = accounts.tenant_id 
FROM accounts 
WHERE customers.account_id = accounts.id 
AND customers.tenant_id IS NULL
AND accounts.tenant_id IS NOT NULL;

-- Backfill support_tickets.tenant_id from accounts
UPDATE support_tickets 
SET tenant_id = accounts.tenant_id 
FROM accounts 
WHERE support_tickets.account_id = accounts.id 
AND support_tickets.tenant_id IS NULL
AND accounts.tenant_id IS NOT NULL;

-- Phase 2: Fix Column Naming - Add delivery_scheduled_at as alias
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'delivery_scheduled_at'
  ) THEN
    -- Add new column that mirrors scheduled_delivery_time
    ALTER TABLE orders ADD COLUMN delivery_scheduled_at timestamp with time zone;
    
    -- Copy existing data
    UPDATE orders SET delivery_scheduled_at = scheduled_delivery_time WHERE scheduled_delivery_time IS NOT NULL;
    
    -- Create trigger to keep them in sync
    CREATE OR REPLACE FUNCTION sync_delivery_schedule_columns()
    RETURNS TRIGGER AS $func$
    BEGIN
      IF NEW.scheduled_delivery_time IS DISTINCT FROM OLD.scheduled_delivery_time THEN
        NEW.delivery_scheduled_at := NEW.scheduled_delivery_time;
      END IF;
      IF NEW.delivery_scheduled_at IS DISTINCT FROM OLD.delivery_scheduled_at THEN
        NEW.scheduled_delivery_time := NEW.delivery_scheduled_at;
      END IF;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS sync_delivery_schedule ON orders;
    CREATE TRIGGER sync_delivery_schedule
      BEFORE INSERT OR UPDATE ON orders
      FOR EACH ROW
      EXECUTE FUNCTION sync_delivery_schedule_columns();
  END IF;
END $$;

-- Phase 3: Add Critical Foreign Key Constraints
-- Orders relationships
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_orders_customer'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT fk_orders_customer 
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_orders_courier'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT fk_orders_courier 
      FOREIGN KEY (courier_id) REFERENCES couriers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Commission transactions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_commission_order'
  ) THEN
    ALTER TABLE commission_transactions ADD CONSTRAINT fk_commission_order
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Courier earnings
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_courier_earnings_courier'
  ) THEN
    ALTER TABLE courier_earnings ADD CONSTRAINT fk_courier_earnings_courier
      FOREIGN KEY (courier_id) REFERENCES couriers(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_courier_earnings_order'
  ) THEN
    ALTER TABLE courier_earnings ADD CONSTRAINT fk_courier_earnings_order
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Phase 4: Add RLS Policies for Core Tables

-- Orders RLS Policies
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view own orders" ON orders;
CREATE POLICY "Tenant members can view own orders"
  ON orders FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Tenant members can insert orders" ON orders;
CREATE POLICY "Tenant members can insert orders"
  ON orders FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant members can update own orders" ON orders;
CREATE POLICY "Tenant members can update own orders"
  ON orders FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- Customers RLS Policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view own customers" ON customers;
CREATE POLICY "Tenant members can view own customers"
  ON customers FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant members can insert customers" ON customers;
CREATE POLICY "Tenant members can insert customers"
  ON customers FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant members can update own customers" ON customers;
CREATE POLICY "Tenant members can update own customers"
  ON customers FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- Support Tickets RLS Policies
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view own tickets" ON support_tickets;
CREATE POLICY "Tenant members can view own tickets"
  ON support_tickets FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant members can insert tickets" ON support_tickets;
CREATE POLICY "Tenant members can insert tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant members can update own tickets" ON support_tickets;
CREATE POLICY "Tenant members can update own tickets"
  ON support_tickets FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- Products RLS Policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view own products" ON products;
CREATE POLICY "Tenant members can view own products"
  ON products FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
    OR tenant_id IS NULL
  );

DROP POLICY IF EXISTS "Tenant members can insert products" ON products;
CREATE POLICY "Tenant members can insert products"
  ON products FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant members can update own products" ON products;
CREATE POLICY "Tenant members can update own products"
  ON products FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant members can delete own products" ON products;
CREATE POLICY "Tenant members can delete own products"
  ON products FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );
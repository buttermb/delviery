-- ============================================================================
-- COMPREHENSIVE RLS POLICY FIX FOR TENANT ISOLATION
-- ============================================================================
-- Problem: Policies use profiles.account_id which is NULL
-- Solution: Use tenant_users table as source of truth for tenant membership
-- ============================================================================
-- Author: System Architect
-- Date: 2024-11-26
-- Priority: CRITICAL - Blocks cash register, invoices, orders
-- ============================================================================

BEGIN;

-- ============================================================================
-- HELPER FUNCTION: Check Tenant Membership
-- ============================================================================

CREATE OR REPLACE FUNCTION is_tenant_member(check_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check if current user is a member of the specified tenant
  RETURN EXISTS (
    SELECT 1 
    FROM tenant_users
    WHERE user_id = auth.uid() 
      AND tenant_id = check_tenant_id
  );
END;
$$;

COMMENT ON FUNCTION is_tenant_member IS 'Returns true if current user is a member of the specified tenant. Used by RLS policies for tenant isolation.';

-- ============================================================================
-- FIX: pos_transactions table
-- ============================================================================

DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can insert transactions" ON pos_transactions;
  DROP POLICY IF EXISTS "Users can create transactions" ON pos_transactions;
  DROP POLICY IF EXISTS "Users can view transactions" ON pos_transactions;
  DROP POLICY IF EXISTS "Users can select transactions" ON pos_transactions;
  DROP POLICY IF EXISTS "Users can update transactions" ON pos_transactions;
  DROP POLICY IF EXISTS "Users can delete transactions" ON pos_transactions;
  DROP POLICY IF EXISTS "Tenant members can create transactions" ON pos_transactions;
  DROP POLICY IF EXISTS "Tenant members can view transactions" ON pos_transactions;
  DROP POLICY IF EXISTS "Tenant members can update transactions" ON pos_transactions;
  DROP POLICY IF EXISTS "Tenant members can delete transactions" ON pos_transactions;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies
CREATE POLICY "Tenant members can create transactions"
ON pos_transactions FOR INSERT
WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can view transactions"
ON pos_transactions FOR SELECT
USING (is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can update transactions"
ON pos_transactions FOR UPDATE
USING (is_tenant_member(tenant_id))
WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can delete transactions"
ON pos_transactions FOR DELETE
USING (is_tenant_member(tenant_id));

-- ============================================================================
-- FIX: clients table (wholesale clients)
-- ============================================================================

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view clients" ON clients;
  DROP POLICY IF EXISTS "Users can create clients" ON clients;
  DROP POLICY IF EXISTS "Users can update clients" ON clients;
  DROP POLICY IF EXISTS "Users can delete clients" ON clients;
  DROP POLICY IF EXISTS "Tenant members can view clients" ON clients;
  DROP POLICY IF EXISTS "Tenant members can create clients" ON clients;
  DROP POLICY IF EXISTS "Tenant members can update clients" ON clients;
  DROP POLICY IF EXISTS "Tenant members can delete clients" ON clients;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Tenant members can view clients"
ON clients FOR SELECT
USING (is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can create clients"
ON clients FOR INSERT
WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can update clients"
ON clients FOR UPDATE
USING (is_tenant_member(tenant_id))
WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can delete clients"
ON clients FOR DELETE
USING (is_tenant_member(tenant_id));

-- ============================================================================
-- FIX: invoices table
-- ============================================================================

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view invoices" ON invoices;
  DROP POLICY IF EXISTS "Users can create invoices" ON invoices;
  DROP POLICY IF EXISTS "Users can update invoices" ON invoices;
  DROP POLICY IF EXISTS "Users can delete invoices" ON invoices;
  DROP POLICY IF EXISTS "Tenant members can view invoices" ON invoices;
  DROP POLICY IF EXISTS "Tenant members can create invoices" ON invoices;
  DROP POLICY IF EXISTS "Tenant members can update invoices" ON invoices;
  DROP POLICY IF EXISTS "Tenant members can delete invoices" ON invoices;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Tenant members can view invoices"
ON invoices FOR SELECT
USING (is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can create invoices"
ON invoices FOR INSERT
WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can update invoices"
ON invoices FOR UPDATE
USING (is_tenant_member(tenant_id))
WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can delete invoices"
ON invoices FOR DELETE
USING (is_tenant_member(tenant_id));

-- ============================================================================
-- FIX: orders table
-- ============================================================================

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view orders" ON orders;
  DROP POLICY IF EXISTS "Users can create orders" ON orders;
  DROP POLICY IF EXISTS "Users can insert orders" ON orders;
  DROP POLICY IF EXISTS "Users can update orders" ON orders;
  DROP POLICY IF EXISTS "Users can delete orders" ON orders;
  DROP POLICY IF EXISTS "Tenant members can view orders" ON orders;
  DROP POLICY IF EXISTS "Authenticated users can create orders" ON orders;
  DROP POLICY IF EXISTS "Tenant members can update orders" ON orders;
  DROP POLICY IF EXISTS "Tenant members can delete orders" ON orders;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Tenant members can view orders"
ON orders FOR SELECT
USING (is_tenant_member(tenant_id));

CREATE POLICY "Authenticated users can create orders"
ON orders FOR INSERT
WITH CHECK (
  -- Allow tenant members to create orders
  is_tenant_member(tenant_id)
  OR
  -- Allow any authenticated user (for customer orders)
  auth.uid() IS NOT NULL
);

CREATE POLICY "Tenant members can update orders"
ON orders FOR UPDATE
USING (is_tenant_member(tenant_id))
WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can delete orders"
ON orders FOR DELETE
USING (is_tenant_member(tenant_id));

-- ============================================================================
-- FIX: products table
-- ============================================================================

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view products" ON products;
  DROP POLICY IF EXISTS "Users can create products" ON products;
  DROP POLICY IF EXISTS "Users can update products" ON products;
  DROP POLICY IF EXISTS "Users can delete products" ON products;
  DROP POLICY IF EXISTS "Tenant members can view products" ON products;
  DROP POLICY IF EXISTS "Tenant members can create products" ON products;
  DROP POLICY IF EXISTS "Tenant members can update products" ON products;
  DROP POLICY IF EXISTS "Tenant members can delete products" ON products;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Tenant members can view products"
ON products FOR SELECT
USING (is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can create products"
ON products FOR INSERT
WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can update products"
ON products FOR UPDATE
USING (is_tenant_member(tenant_id))
WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can delete products"
ON products FOR DELETE
USING (is_tenant_member(tenant_id));

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Speed up tenant_users lookups (used in EVERY RLS check via is_tenant_member)
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_tenant_lookup
ON tenant_users(user_id, tenant_id);

-- Speed up RLS checks with composite indexes
CREATE INDEX IF NOT EXISTS idx_pos_transactions_tenant_created
ON pos_transactions(tenant_id, created_at DESC)
WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_tenant_name
ON clients(tenant_id, name)
WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_tenant_created
ON orders(tenant_id, created_at DESC)
WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_created
ON invoices(tenant_id, created_at DESC)
WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_tenant_status
ON products(tenant_id, status)
WHERE tenant_id IS NOT NULL;

-- ============================================================================
-- VERIFICATION QUERIES (Run these after migration to verify)
-- ============================================================================

-- Verify helper function works
-- SELECT is_tenant_member((SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1));

-- Verify you can see transactions (should return count, not error)
-- SELECT COUNT(*) FROM pos_transactions;

-- Verify you can see clients
-- SELECT COUNT(*) FROM clients;

-- Verify you can see invoices
-- SELECT COUNT(*) FROM invoices;

-- Verify you can see orders
-- SELECT COUNT(*) FROM orders;

-- Verify you can see products
-- SELECT COUNT(*) FROM products;

COMMIT;

-- ============================================================================
-- ROLLBACK PLAN (if issues occur)
-- ============================================================================
-- If this migration causes issues, run:
-- DROP FUNCTION IF EXISTS is_tenant_member(UUID);
-- Then restore old policies from backup
-- ============================================================================

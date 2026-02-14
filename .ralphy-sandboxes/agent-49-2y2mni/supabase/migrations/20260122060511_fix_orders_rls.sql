-- ============================================================================
-- Fix overly permissive RLS policies on orders table
--
-- Problem: Current policies use is_tenant_member() function and have an overly
-- permissive INSERT policy that allows any authenticated user to create orders.
--
-- Solution: Use tenant_users table directly for tenant membership checks,
-- consistent with products and vendors tables. Add separate policies for:
-- 1. Staff access to tenant orders (via tenant_users)
-- 2. Customer access to their own orders (via customer_id = auth.uid())
-- ============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Tenant members can view orders" ON orders;
DROP POLICY IF EXISTS "Authenticated users can create orders" ON orders;
DROP POLICY IF EXISTS "Tenant members can update orders" ON orders;
DROP POLICY IF EXISTS "Tenant members can delete orders" ON orders;
DROP POLICY IF EXISTS "Users can view orders" ON orders;
DROP POLICY IF EXISTS "Users can create orders" ON orders;
DROP POLICY IF EXISTS "Users can insert orders" ON orders;
DROP POLICY IF EXISTS "Users can update orders" ON orders;
DROP POLICY IF EXISTS "Users can delete orders" ON orders;
DROP POLICY IF EXISTS "orders_tenant_select" ON orders;
DROP POLICY IF EXISTS "orders_tenant_insert" ON orders;
DROP POLICY IF EXISTS "orders_tenant_update" ON orders;
DROP POLICY IF EXISTS "orders_tenant_delete" ON orders;
DROP POLICY IF EXISTS "orders_staff_select" ON orders;
DROP POLICY IF EXISTS "orders_customer_select" ON orders;
DROP POLICY IF EXISTS "orders_customer_insert" ON orders;

-- ============================================================================
-- SELECT POLICIES
-- ============================================================================

-- Staff can see all orders within their tenant
CREATE POLICY "orders_staff_select" ON orders FOR SELECT
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- Customers can see their own orders (regardless of tenant membership)
CREATE POLICY "orders_customer_select" ON orders FOR SELECT
  USING (customer_id = auth.uid());

-- ============================================================================
-- INSERT POLICIES
-- ============================================================================

-- Staff can create orders for their tenant
CREATE POLICY "orders_staff_insert" ON orders FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- Customers can create orders for themselves
-- (tenant_id must be provided by the application/RPC, not customer)
CREATE POLICY "orders_customer_insert" ON orders FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- ============================================================================
-- UPDATE POLICIES
-- ============================================================================

-- Only staff can update orders (customers cannot modify orders)
CREATE POLICY "orders_staff_update" ON orders FOR UPDATE
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- ============================================================================
-- DELETE POLICIES
-- ============================================================================

-- Only staff can delete orders
CREATE POLICY "orders_staff_delete" ON orders FOR DELETE
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- ============================================================================
-- VERIFICATION QUERIES (Run these after migration to verify)
-- ============================================================================
-- Check policies exist:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'orders';
--
-- Expected result:
-- | policyname              | cmd    |
-- |-------------------------|--------|
-- | orders_staff_select     | SELECT |
-- | orders_customer_select  | SELECT |
-- | orders_staff_insert     | INSERT |
-- | orders_customer_insert  | INSERT |
-- | orders_staff_update     | UPDATE |
-- | orders_staff_delete     | DELETE |
-- ============================================================================

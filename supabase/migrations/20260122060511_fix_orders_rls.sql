-- ============================================================================
-- Fix overly permissive RLS policies on orders table
--
-- Problem: Current policies use is_tenant_member() function and have an overly
-- permissive INSERT policy that allows any authenticated user to create orders.
-- The orders table does NOT have a tenant_id column.
--
-- Solution: Use EXISTS checks against tenant_users for staff access,
-- and user_id = auth.uid() for customer self-access.
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
DROP POLICY IF EXISTS "orders_staff_insert" ON orders;
DROP POLICY IF EXISTS "orders_staff_update" ON orders;
DROP POLICY IF EXISTS "orders_staff_delete" ON orders;

-- ============================================================================
-- SELECT POLICIES
-- ============================================================================

-- Staff (any tenant member) can see orders
CREATE POLICY "orders_staff_select" ON orders FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- Customers can see their own orders (regardless of tenant membership)
CREATE POLICY "orders_customer_select" ON orders FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- INSERT POLICIES
-- ============================================================================

-- Staff (admin/owner) can create orders
CREATE POLICY "orders_staff_insert" ON orders FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

-- Customers can create orders for themselves
CREATE POLICY "orders_customer_insert" ON orders FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- UPDATE POLICIES
-- ============================================================================

-- Only staff (admin/owner) can update orders
CREATE POLICY "orders_staff_update" ON orders FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

-- ============================================================================
-- DELETE POLICIES
-- ============================================================================

-- Only staff (admin/owner) can delete orders
CREATE POLICY "orders_staff_delete" ON orders FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
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

-- ============================================================================
-- Tighten RLS on marketplace_orders and marketplace_order_items
--
-- Problems:
--   1. "System can create orders" has WITH CHECK (true) — any authenticated
--      user can insert orders directly, bypassing the create_marketplace_order
--      SECURITY DEFINER RPC (which handles validation, inventory, etc.)
--   2. "Sellers can update order status" has no admin role restriction — any
--      tenant member (including viewer/member roles) can update orders
--   3. No DELETE policy exists
--   4. marketplace_order_items has same WITH CHECK (true) INSERT issue
--
-- Solution:
--   - SELECT: buyer or seller tenant members can view (any role)
--   - INSERT: admin-only for their own tenant (direct inserts are rare;
--     normal flow uses SECURITY DEFINER RPC which bypasses RLS)
--   - UPDATE: admin-only for buyer or seller tenant
--   - DELETE: admin-only for seller tenant
--   - Customer tracking: handled by get_marketplace_order_by_token SECURITY
--     DEFINER RPC (already grants anon/authenticated/service_role)
-- ============================================================================

-- ============================================================================
-- 1. MARKETPLACE_ORDERS — Drop existing policies
-- ============================================================================

DROP POLICY IF EXISTS "Buyers can view own orders" ON public.marketplace_orders;
DROP POLICY IF EXISTS "Sellers can view orders for their products" ON public.marketplace_orders;
DROP POLICY IF EXISTS "System can create orders" ON public.marketplace_orders;
DROP POLICY IF EXISTS "Sellers can update order status" ON public.marketplace_orders;

-- ============================================================================
-- 2. MARKETPLACE_ORDERS — SELECT
-- ============================================================================

-- Tenant members (any role) can view orders where they are buyer or seller
CREATE POLICY "mo_tenant_select"
  ON public.marketplace_orders FOR SELECT
  USING (
    buyer_tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
    OR seller_tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. MARKETPLACE_ORDERS — INSERT
-- ============================================================================

-- Admin-only direct inserts for their own tenant.
-- Normal order creation uses create_marketplace_order() SECURITY DEFINER RPC,
-- which bypasses RLS entirely.
CREATE POLICY "mo_admin_insert"
  ON public.marketplace_orders FOR INSERT
  WITH CHECK (
    seller_tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- 4. MARKETPLACE_ORDERS — UPDATE
-- ============================================================================

-- Admin-only: owners/admins of the buyer or seller tenant can update orders
CREATE POLICY "mo_admin_update"
  ON public.marketplace_orders FOR UPDATE
  USING (
    buyer_tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR seller_tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    buyer_tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR seller_tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- 5. MARKETPLACE_ORDERS — DELETE
-- ============================================================================

-- Admin-only: owners/admins of the seller tenant can delete orders
CREATE POLICY "mo_admin_delete"
  ON public.marketplace_orders FOR DELETE
  USING (
    seller_tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- 6. MARKETPLACE_ORDER_ITEMS — Drop existing policies
-- ============================================================================

DROP POLICY IF EXISTS "Order items inherit order access" ON public.marketplace_order_items;
DROP POLICY IF EXISTS "System can create order items" ON public.marketplace_order_items;

-- ============================================================================
-- 7. MARKETPLACE_ORDER_ITEMS — SELECT
-- ============================================================================

-- Tenant members can view items for orders they have access to
CREATE POLICY "moi_tenant_select"
  ON public.marketplace_order_items FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM public.marketplace_orders
      WHERE buyer_tenant_id IN (
        SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
      )
      OR seller_tenant_id IN (
        SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 8. MARKETPLACE_ORDER_ITEMS — INSERT
-- ============================================================================

-- Admin-only: items are normally created by create_marketplace_order() RPC
CREATE POLICY "moi_admin_insert"
  ON public.marketplace_order_items FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.marketplace_orders
      WHERE seller_tenant_id IN (
        SELECT tenant_id FROM public.tenant_users
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Check policies exist:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'marketplace_orders';
--
-- Expected:
--   | policyname       | cmd    |
--   |------------------|--------|
--   | mo_tenant_select | SELECT |
--   | mo_admin_insert  | INSERT |
--   | mo_admin_update  | UPDATE |
--   | mo_admin_delete  | DELETE |
--
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'marketplace_order_items';
--
-- Expected:
--   | policyname        | cmd    |
--   |-------------------|--------|
--   | moi_tenant_select | SELECT |
--   | moi_admin_insert  | INSERT |
-- ============================================================================

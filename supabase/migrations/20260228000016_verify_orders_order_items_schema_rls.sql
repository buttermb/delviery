-- ============================================================================
-- Verify orders and order_items table schema and tighten order_items RLS
--
-- orders table:
--   - Schema verified: all required columns present (tenant_id, customer_id,
--     status, payment_method, subtotal, total_amount, order_number, etc.)
--   - RLS already tightened in 20260122060511_fix_orders_rls.sql
--   - No changes needed for orders table
--
-- order_items table:
--   - Schema verified: all required columns present (order_id, product_id,
--     product_name, price, quantity)
--   - RLS PROBLEM: Legacy policies use admin_users table and overly permissive
--     WITH CHECK (true) for inserts. Needs tenant-based policies consistent
--     with the orders table fix.
--
-- After:
--   order_items:
--   - SELECT: Staff can read items for orders in their tenant.
--             Customers can read items for their own orders.
--   - INSERT: Staff can create items for orders in their tenant.
--             Customers can create items for their own orders.
--   - UPDATE: Only staff can update order items.
--   - DELETE: Only staff can delete order items.
-- ============================================================================

-- ============================================================================
-- Drop legacy order_items policies
-- ============================================================================
DROP POLICY IF EXISTS "admin_all_order_items" ON public.order_items;
DROP POLICY IF EXISTS "users_read_own_order_items" ON public.order_items;
DROP POLICY IF EXISTS "system_insert_order_items" ON public.order_items;
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Tenant members can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Tenant members can manage order items" ON public.order_items;
DROP POLICY IF EXISTS "order_items_tenant_select" ON public.order_items;
DROP POLICY IF EXISTS "order_items_tenant_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_tenant_update" ON public.order_items;
DROP POLICY IF EXISTS "order_items_tenant_delete" ON public.order_items;
DROP POLICY IF EXISTS "order_items_staff_select" ON public.order_items;
DROP POLICY IF EXISTS "order_items_customer_select" ON public.order_items;
DROP POLICY IF EXISTS "order_items_staff_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_customer_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_staff_update" ON public.order_items;
DROP POLICY IF EXISTS "order_items_staff_delete" ON public.order_items;

-- Ensure RLS is enabled
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SELECT: Staff can read order items for orders in their tenant
-- ============================================================================
CREATE POLICY "order_items_staff_select" ON public.order_items FOR SELECT
  USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.tenant_id IN (
        SELECT tu.tenant_id FROM public.tenant_users tu
        WHERE tu.user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- SELECT: Customers can read items for their own orders
-- ============================================================================
CREATE POLICY "order_items_customer_select" ON public.order_items FOR SELECT
  USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.customer_id = auth.uid()
    )
  );

-- ============================================================================
-- INSERT: Staff can create items for orders in their tenant
-- ============================================================================
CREATE POLICY "order_items_staff_insert" ON public.order_items FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.tenant_id IN (
        SELECT tu.tenant_id FROM public.tenant_users tu
        WHERE tu.user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- INSERT: Customers can create items for their own orders
-- ============================================================================
CREATE POLICY "order_items_customer_insert" ON public.order_items FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.customer_id = auth.uid()
    )
  );

-- ============================================================================
-- UPDATE: Only staff can update order items
-- ============================================================================
CREATE POLICY "order_items_staff_update" ON public.order_items FOR UPDATE
  USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.tenant_id IN (
        SELECT tu.tenant_id FROM public.tenant_users tu
        WHERE tu.user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- DELETE: Only staff can delete order items
-- ============================================================================
CREATE POLICY "order_items_staff_delete" ON public.order_items FOR DELETE
  USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.tenant_id IN (
        SELECT tu.tenant_id FROM public.tenant_users tu
        WHERE tu.user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Check orders policies:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'orders';
--
-- Expected (from 20260122060511_fix_orders_rls.sql):
--   | policyname              | cmd    |
--   |-------------------------|--------|
--   | orders_staff_select     | SELECT |
--   | orders_customer_select  | SELECT |
--   | orders_staff_insert     | INSERT |
--   | orders_customer_insert  | INSERT |
--   | orders_staff_update     | UPDATE |
--   | orders_staff_delete     | DELETE |
--
-- Check order_items policies:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'order_items';
--
-- Expected:
--   | policyname                   | cmd    |
--   |------------------------------|--------|
--   | order_items_staff_select     | SELECT |
--   | order_items_customer_select  | SELECT |
--   | order_items_staff_insert     | INSERT |
--   | order_items_customer_insert  | INSERT |
--   | order_items_staff_update     | UPDATE |
--   | order_items_staff_delete     | DELETE |
--
-- Verify orders schema columns:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'orders'
--   ORDER BY ordinal_position;
--
-- Expected key columns: id, tenant_id, customer_id, status, payment_method,
--   payment_status, subtotal, total_amount, delivery_fee, delivery_address,
--   delivery_borough, order_number, order_type, courier_id, tracking_code,
--   created_at, version
--
-- Verify order_items schema columns:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'order_items'
--   ORDER BY ordinal_position;
--
-- Expected key columns: id, order_id, product_id, product_name, price,
--   quantity, created_at
-- ============================================================================

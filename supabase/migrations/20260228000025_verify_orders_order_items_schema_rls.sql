-- ============================================================================
-- Tighten order_items RLS
-- Note: orders table has NO tenant_id column. Staff policies use EXISTS
-- check on tenant_users. Customer policies use customer_id on orders.
-- ============================================================================

-- Drop legacy order_items policies
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

-- SELECT: Staff (any tenant user) can read order items
CREATE POLICY "order_items_staff_select" ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- SELECT: Customers can read items for their own orders
CREATE POLICY "order_items_customer_select" ON public.order_items FOR SELECT
  USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.user_id = auth.uid()
    )
  );

-- INSERT: Staff can create order items
CREATE POLICY "order_items_staff_insert" ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- INSERT: Customers can create items for their own orders
CREATE POLICY "order_items_customer_insert" ON public.order_items FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.user_id = auth.uid()
    )
  );

-- UPDATE: Only staff can update order items
CREATE POLICY "order_items_staff_update" ON public.order_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- DELETE: Only staff can delete order items
CREATE POLICY "order_items_staff_delete" ON public.order_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

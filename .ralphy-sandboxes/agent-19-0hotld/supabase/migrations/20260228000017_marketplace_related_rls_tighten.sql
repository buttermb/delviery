-- ============================================================================
-- Tighten RLS on marketplace-related tables
--
-- Tables affected:
--   1. marketplace_product_settings - had overly permissive FOR ALL policy
--   2. marketplace_categories - had overly permissive FOR ALL policy
--   3. marketplace_coupons - had overly permissive FOR ALL policy
--   4. marketplace_customers - had buggy seller SELECT and missing admin CRUD
--   5. marketplace_order_items - missing UPDATE/DELETE policies
--
-- Pattern:
--   - SELECT: public can read visible/active items; tenant members can read own
--   - INSERT/UPDATE/DELETE: restricted to tenant owner/admin roles
--   - marketplace_customers: tenant admin access via store_id -> store -> tenant
--   - Order items: access derived from parent marketplace_orders
--
-- SECURITY DEFINER functions (create_marketplace_order, etc.) bypass RLS
-- entirely, so storefront order flows are unaffected.
-- ============================================================================

-- ============================================================================
-- 1. MARKETPLACE_PRODUCT_SETTINGS
-- ============================================================================

-- Drop overly permissive FOR ALL policy (any tenant member could INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "Tenant members can manage product settings" ON public.marketplace_product_settings;

-- Tenant admins can INSERT product settings
CREATE POLICY "mps_admin_insert"
  ON public.marketplace_product_settings FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT ms.id FROM public.marketplace_stores ms
      JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- Tenant admins can UPDATE product settings
CREATE POLICY "mps_admin_update"
  ON public.marketplace_product_settings FOR UPDATE
  USING (
    store_id IN (
      SELECT ms.id FROM public.marketplace_stores ms
      JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT ms.id FROM public.marketplace_stores ms
      JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- Tenant admins can DELETE product settings
CREATE POLICY "mps_admin_delete"
  ON public.marketplace_product_settings FOR DELETE
  USING (
    store_id IN (
      SELECT ms.id FROM public.marketplace_stores ms
      JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- Tenant members can still SELECT their own store's product settings (any role)
CREATE POLICY "mps_tenant_select"
  ON public.marketplace_product_settings FOR SELECT
  USING (
    store_id IN (
      SELECT ms.id FROM public.marketplace_stores ms
      JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

-- Note: "Public can view visible product settings" policy remains unchanged

-- ============================================================================
-- 2. MARKETPLACE_CATEGORIES
-- ============================================================================

-- Drop overly permissive FOR ALL policy
DROP POLICY IF EXISTS "Tenant members can manage categories" ON public.marketplace_categories;

-- Tenant admins can INSERT categories
CREATE POLICY "mc_admin_insert"
  ON public.marketplace_categories FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT ms.id FROM public.marketplace_stores ms
      JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- Tenant admins can UPDATE categories
CREATE POLICY "mc_admin_update"
  ON public.marketplace_categories FOR UPDATE
  USING (
    store_id IN (
      SELECT ms.id FROM public.marketplace_stores ms
      JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT ms.id FROM public.marketplace_stores ms
      JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- Tenant admins can DELETE categories
CREATE POLICY "mc_admin_delete"
  ON public.marketplace_categories FOR DELETE
  USING (
    store_id IN (
      SELECT ms.id FROM public.marketplace_stores ms
      JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- Tenant members can SELECT their own store's categories (any role)
CREATE POLICY "mc_tenant_select"
  ON public.marketplace_categories FOR SELECT
  USING (
    store_id IN (
      SELECT ms.id FROM public.marketplace_stores ms
      JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

-- Note: "Public can view active categories" policy remains unchanged

-- ============================================================================
-- 3. MARKETPLACE_COUPONS
-- ============================================================================

-- Drop overly permissive FOR ALL policy
DROP POLICY IF EXISTS "Tenant members can manage coupons" ON public.marketplace_coupons;

-- Tenant admins can SELECT coupons (only admins should see discount codes)
CREATE POLICY "mcoup_admin_select"
  ON public.marketplace_coupons FOR SELECT
  USING (
    store_id IN (
      SELECT ms.id FROM public.marketplace_stores ms
      JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- Tenant admins can INSERT coupons
CREATE POLICY "mcoup_admin_insert"
  ON public.marketplace_coupons FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT ms.id FROM public.marketplace_stores ms
      JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- Tenant admins can UPDATE coupons
CREATE POLICY "mcoup_admin_update"
  ON public.marketplace_coupons FOR UPDATE
  USING (
    store_id IN (
      SELECT ms.id FROM public.marketplace_stores ms
      JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT ms.id FROM public.marketplace_stores ms
      JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- Tenant admins can DELETE coupons
CREATE POLICY "mcoup_admin_delete"
  ON public.marketplace_coupons FOR DELETE
  USING (
    store_id IN (
      SELECT ms.id FROM public.marketplace_stores ms
      JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- 4. MARKETPLACE_CUSTOMERS
-- ============================================================================

-- Drop existing policies (the seller SELECT policy has a bug using
-- tenant_users.id instead of tenant_users.user_id)
DROP POLICY IF EXISTS "Sellers can view own customers" ON public.marketplace_customers;
DROP POLICY IF EXISTS "Super admins can view all customers" ON public.marketplace_customers;

-- Super admins retain full access
CREATE POLICY "mcust_super_admin_all"
  ON public.marketplace_customers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admin_users
      WHERE id = auth.uid()::text::uuid
    )
  );

-- Tenant admins can SELECT their store's customers
-- (store_id references marketplace_profiles which has tenant_id)
CREATE POLICY "mcust_admin_select"
  ON public.marketplace_customers FOR SELECT
  USING (
    store_id IN (
      SELECT mp.id FROM public.marketplace_profiles mp
      JOIN public.tenant_users tu ON mp.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- Tenant admins can INSERT customers (manual creation from admin)
CREATE POLICY "mcust_admin_insert"
  ON public.marketplace_customers FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT mp.id FROM public.marketplace_profiles mp
      JOIN public.tenant_users tu ON mp.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- Tenant admins can UPDATE their store's customers
CREATE POLICY "mcust_admin_update"
  ON public.marketplace_customers FOR UPDATE
  USING (
    store_id IN (
      SELECT mp.id FROM public.marketplace_profiles mp
      JOIN public.tenant_users tu ON mp.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT mp.id FROM public.marketplace_profiles mp
      JOIN public.tenant_users tu ON mp.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- Tenant admins can DELETE their store's customers
CREATE POLICY "mcust_admin_delete"
  ON public.marketplace_customers FOR DELETE
  USING (
    store_id IN (
      SELECT mp.id FROM public.marketplace_profiles mp
      JOIN public.tenant_users tu ON mp.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- 5. MARKETPLACE_ORDER_ITEMS — Add missing UPDATE/DELETE policies
-- ============================================================================

-- Admin-only UPDATE for order items (via parent order's seller tenant)
CREATE POLICY "moi_admin_update"
  ON public.marketplace_order_items FOR UPDATE
  USING (
    order_id IN (
      SELECT id FROM public.marketplace_orders
      WHERE seller_tenant_id IN (
        SELECT tenant_id FROM public.tenant_users
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.marketplace_orders
      WHERE seller_tenant_id IN (
        SELECT tenant_id FROM public.tenant_users
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- Admin-only DELETE for order items (via parent order's seller tenant)
CREATE POLICY "moi_admin_delete"
  ON public.marketplace_order_items FOR DELETE
  USING (
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
-- Check policies per table:
--
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'marketplace_product_settings';
--   Expected:
--     | Public can view visible product settings | SELECT |
--     | mps_tenant_select                        | SELECT |
--     | mps_admin_insert                         | INSERT |
--     | mps_admin_update                         | UPDATE |
--     | mps_admin_delete                         | DELETE |
--
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'marketplace_categories';
--   Expected:
--     | Public can view active categories | SELECT |
--     | mc_tenant_select                  | SELECT |
--     | mc_admin_insert                   | INSERT |
--     | mc_admin_update                   | UPDATE |
--     | mc_admin_delete                   | DELETE |
--
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'marketplace_coupons';
--   Expected:
--     | mcoup_admin_select | SELECT |
--     | mcoup_admin_insert | INSERT |
--     | mcoup_admin_update | UPDATE |
--     | mcoup_admin_delete | DELETE |
--
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'marketplace_customers';
--   Expected:
--     | mcust_super_admin_all | ALL    |
--     | mcust_admin_select    | SELECT |
--     | mcust_admin_insert    | INSERT |
--     | mcust_admin_update    | UPDATE |
--     | mcust_admin_delete    | DELETE |
--
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'marketplace_order_items';
--   Expected (cumulative with existing):
--     | moi_tenant_select | SELECT |
--     | moi_admin_insert  | INSERT |
--     | moi_admin_update  | UPDATE |
--     | moi_admin_delete  | DELETE |
-- ============================================================================

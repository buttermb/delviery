-- ============================================================================
-- Tighten RLS on products table
--
-- Before: Any tenant member (including 'member' and 'viewer' roles) could
--   SELECT/INSERT/UPDATE/DELETE products for their tenant via auth.user_tenant_ids().
--   Anonymous users (storefront visitors) could NOT read products at all.
--
-- After:
--   - SELECT: Public (anon + authenticated) can read any product.
--     Storefront components (CartStockWarning, CheckoutPage) query products
--     directly by ID for stock checks. The main catalog uses the
--     get_marketplace_products SECURITY DEFINER RPC which bypasses RLS.
--     Visibility filtering (published/active) is handled at the application
--     layer via marketplace_product_settings.is_visible and the RPC.
--   - INSERT: Only tenant owners/admins can create products.
--   - UPDATE: Only tenant owners/admins can modify products.
--   - DELETE: Only tenant owners/admins can delete products.
--
-- Edge functions (storefront-checkout, etc.) run as service_role which
-- bypasses RLS entirely, so they can still read/write products.
--
-- SECURITY DEFINER functions (get_marketplace_products, create_marketplace_order,
-- archive_product, etc.) also bypass RLS.
-- ============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "products_tenant_select" ON public.products;
DROP POLICY IF EXISTS "products_tenant_insert" ON public.products;
DROP POLICY IF EXISTS "products_tenant_update" ON public.products;
DROP POLICY IF EXISTS "products_tenant_delete" ON public.products;

-- Also drop any older policy names that may linger
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
DROP POLICY IF EXISTS "Products viewable by age-verified users only" ON public.products;
DROP POLICY IF EXISTS "Products viewable by everyone" ON public.products;
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
DROP POLICY IF EXISTS "Block anonymous access to products" ON public.products;
DROP POLICY IF EXISTS "Tenant members can view products" ON public.products;
DROP POLICY IF EXISTS "Tenant members can create products" ON public.products;
DROP POLICY IF EXISTS "Tenant members can update products" ON public.products;
DROP POLICY IF EXISTS "Tenant members can delete products" ON public.products;
DROP POLICY IF EXISTS "Tenant members can view own products" ON public.products;
DROP POLICY IF EXISTS "Tenant members can insert products" ON public.products;
DROP POLICY IF EXISTS "Tenant members can update own products" ON public.products;
DROP POLICY IF EXISTS "Tenant members can delete own products" ON public.products;
DROP POLICY IF EXISTS "Tenants can manage own products" ON public.products;
DROP POLICY IF EXISTS "tenant_isolation_products" ON public.products;
DROP POLICY IF EXISTS "admin_all_products" ON public.products;
DROP POLICY IF EXISTS "public_read_products" ON public.products;
DROP POLICY IF EXISTS "tenant_admins_manage_products" ON public.products;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.products;

-- Ensure RLS is enabled
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SELECT: Public read access (anon + authenticated)
-- Storefront visitors need to read products for stock checks and browsing.
-- Visibility/published filtering is handled at the application layer.
-- ============================================================================
CREATE POLICY "products_public_select"
  ON public.products FOR SELECT
  USING (true);

-- ============================================================================
-- INSERT: Only tenant owners/admins can create products
-- ============================================================================
CREATE POLICY "products_admin_insert"
  ON public.products FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- UPDATE: Only tenant owners/admins can modify products
-- ============================================================================
CREATE POLICY "products_admin_update"
  ON public.products FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- DELETE: Only tenant owners/admins can delete products
-- ============================================================================
CREATE POLICY "products_admin_delete"
  ON public.products FOR DELETE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Check policies exist:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'products';
--
-- Expected:
--   | policyname              | cmd    |
--   |-------------------------|--------|
--   | products_public_select  | SELECT |
--   | products_admin_insert   | INSERT |
--   | products_admin_update   | UPDATE |
--   | products_admin_delete   | DELETE |
--
-- Test public read:
--   SET ROLE anon;
--   SELECT id, name FROM products LIMIT 5;  -- Should succeed
--   INSERT INTO products (name, ...) VALUES (...);  -- Should fail
--   RESET ROLE;
-- ============================================================================

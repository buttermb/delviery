-- ============================================================================
-- Tighten RLS on products table
-- Note: products table has NO tenant_id column, so write policies use
-- EXISTS check on tenant_users (same pattern as existing policies).
-- ============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "products_tenant_select" ON public.products;
DROP POLICY IF EXISTS "products_tenant_insert" ON public.products;
DROP POLICY IF EXISTS "products_tenant_update" ON public.products;
DROP POLICY IF EXISTS "products_tenant_delete" ON public.products;
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

-- SELECT: Public read access (anon + authenticated)
CREATE POLICY "products_public_select"
  ON public.products FOR SELECT
  USING (true);

-- INSERT: Only tenant owners/admins
CREATE POLICY "products_admin_insert"
  ON public.products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- UPDATE: Only tenant owners/admins
CREATE POLICY "products_admin_update"
  ON public.products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- DELETE: Only tenant owners/admins
CREATE POLICY "products_admin_delete"
  ON public.products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

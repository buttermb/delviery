-- ============================================
-- TENANT SUSPENSION ENFORCEMENT
-- Enforces tenant suspension in RLS policies
-- ============================================

-- Helper function to check if tenant is active
CREATE OR REPLACE FUNCTION public.is_tenant_active(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tenant_status TEXT;
BEGIN
  SELECT status INTO tenant_status
  FROM tenants
  WHERE id = p_tenant_id;
  
  -- Tenant is active if status is 'active' or NULL (backwards compatibility)
  RETURN (tenant_status IS NULL OR tenant_status = 'active');
END;
$$;

-- Update RLS policies for key tables to check tenant status
-- Products table
DROP POLICY IF EXISTS "Tenants can manage own products" ON public.products;
CREATE POLICY "Tenants can manage own products"
  ON public.products
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
    AND is_tenant_active(tenant_id)
  );

-- Orders table
DROP POLICY IF EXISTS "Tenants can manage own orders" ON public.orders;
CREATE POLICY "Tenants can manage own orders"
  ON public.orders
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
    AND is_tenant_active(tenant_id)
  );

-- Wholesale orders table
DROP POLICY IF EXISTS "Tenants can manage own wholesale orders" ON public.wholesale_orders;
CREATE POLICY "Tenants can manage own wholesale orders"
  ON public.wholesale_orders
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
    AND is_tenant_active(tenant_id)
  );

-- Wholesale clients table
DROP POLICY IF EXISTS "Tenants can manage own wholesale clients" ON public.wholesale_clients;
CREATE POLICY "Tenants can manage own wholesale clients"
  ON public.wholesale_clients
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
    AND is_tenant_active(tenant_id)
  );

-- Disposable menus table
DROP POLICY IF EXISTS "Tenants can manage own menus" ON public.disposable_menus;
CREATE POLICY "Tenants can manage own menus"
  ON public.disposable_menus
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
    AND is_tenant_active(tenant_id)
  );

-- Add comment
COMMENT ON FUNCTION public.is_tenant_active IS 'Checks if a tenant is active (not suspended or inactive)';


-- ============================================================================
-- Allow Tenant Owners to Create Billing Accounts
-- Fixes: "Unable to create billing account for tenant" error during integration setup
-- ============================================================================

-- Step 1: Create helper function to check if user is tenant owner
CREATE OR REPLACE FUNCTION public.is_tenant_owner(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.tenant_users
    WHERE user_id = auth.uid()
      AND tenant_id = p_tenant_id
      AND role = 'owner'
      AND status = 'active'
  );
$$;

COMMENT ON FUNCTION public.is_tenant_owner(UUID) IS 'Checks if the current user is the owner of the specified tenant';

-- Step 2: Update existing RLS policy to allow tenant owners
DROP POLICY IF EXISTS "Admins can manage all accounts" ON public.accounts;

CREATE POLICY "Admins and owners can manage accounts" 
ON public.accounts
FOR ALL
TO authenticated
USING (
  is_admin_user() OR is_tenant_owner(tenant_id)
)
WITH CHECK (
  is_admin_user() OR is_tenant_owner(tenant_id)
);

-- Step 3: Add INSERT-specific policy for tenant owners
CREATE POLICY "Tenant owners can create own account"
ON public.accounts
FOR INSERT
TO authenticated
WITH CHECK (
  is_tenant_owner(tenant_id)
);
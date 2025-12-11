-- Create SECURITY DEFINER helper functions first

-- Function to get tenant IDs for a user (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids_safe(user_uuid UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM tenant_users WHERE user_id = user_uuid AND status = 'active';
$$;

-- Function to check if user is admin/owner of a tenant (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_tenant_admin_safe(user_uuid UUID, check_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_users 
    WHERE user_id = user_uuid 
    AND tenant_id = check_tenant_id 
    AND status = 'active' 
    AND role IN ('owner', 'admin')
  );
$$;

-- Function to check if user belongs to a tenant (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_tenant_member_safe(user_uuid UUID, check_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_users 
    WHERE user_id = user_uuid 
    AND tenant_id = check_tenant_id 
    AND status = 'active'
  );
$$;

-- Now create the non-recursive policies for tenant_users

-- Users can view same tenant members (using safe function)
CREATE POLICY "tenant_users_select_same_tenant"
ON public.tenant_users
FOR SELECT
TO authenticated
USING (public.is_tenant_member_safe(auth.uid(), tenant_id));

-- Admins can insert new team members (using safe function)
CREATE POLICY "tenant_users_insert_admin"
ON public.tenant_users
FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_admin_safe(auth.uid(), tenant_id));

-- Admins can update team members (using safe function)
CREATE POLICY "tenant_users_update_admin"
ON public.tenant_users
FOR UPDATE
TO authenticated
USING (public.is_tenant_admin_safe(auth.uid(), tenant_id));

-- Admins can delete team members (using safe function)
CREATE POLICY "tenant_users_delete_admin"
ON public.tenant_users
FOR DELETE
TO authenticated
USING (public.is_tenant_admin_safe(auth.uid(), tenant_id));

-- Super admins can manage all tenant_users
CREATE POLICY "tenant_users_super_admin_all"
ON public.tenant_users
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Create non-recursive policies for tenants

-- Public slug lookup for login (anon + authenticated)
CREATE POLICY "tenants_select_by_slug_public"
ON public.tenants
FOR SELECT
TO anon, authenticated
USING (slug IS NOT NULL);

-- Users can view tenants they belong to (using safe function)
CREATE POLICY "tenants_select_member"
ON public.tenants
FOR SELECT
TO authenticated
USING (id IN (SELECT public.get_user_tenant_ids_safe(auth.uid())));

-- Tenant admins can update their tenant (using safe function)
CREATE POLICY "tenants_update_admin"
ON public.tenants
FOR UPDATE
TO authenticated
USING (public.is_tenant_admin_safe(auth.uid(), id))
WITH CHECK (public.is_tenant_admin_safe(auth.uid(), id));

-- Super admins can manage all tenants
CREATE POLICY "tenants_super_admin_all"
ON public.tenants
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));
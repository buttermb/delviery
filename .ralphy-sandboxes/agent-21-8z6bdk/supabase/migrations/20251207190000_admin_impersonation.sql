-- RPC for Platform Admins to gain access to a specific tenant
CREATE OR REPLACE FUNCTION public.admin_grant_tenant_access(target_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_slug TEXT;
BEGIN
  v_user_id := auth.uid();
  
  -- 1. Verify Platform Admin status
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access Denied: Not a Platform Admin';
  END IF;

  -- 2. Get Tenant Slug for convenience
  SELECT slug INTO v_slug FROM public.tenants WHERE id = target_tenant_id;
  IF v_slug IS NULL THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  -- 3. Check if already exists in tenant_users
  IF EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = v_user_id AND tenant_id = target_tenant_id) THEN
     -- Already has access, just return success
     RETURN jsonb_build_object('success', true, 'slug', v_slug, 'message', 'Already had access');
  END IF;

  -- 4. Insert into tenant_users
  -- We assume specific columns. Adjust if needed. 
  -- Usually: user_id, tenant_id, role, status, email?
  -- We'll try to get email from auth.users or platform_admins
  
  INSERT INTO public.tenant_users (user_id, tenant_id, role, status, email)
  SELECT 
    v_user_id, 
    target_tenant_id, 
    'admin', 
    'active', 
    (SELECT email FROM auth.users WHERE id = v_user_id);

  RETURN jsonb_build_object('success', true, 'slug', v_slug, 'message', 'Access granted');
END;
$$;

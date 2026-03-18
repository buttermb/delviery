-- Create the missing check_platform_admin_access RPC function
-- This function is called by the usePlatformAdmin hook

CREATE OR REPLACE FUNCTION public.check_platform_admin_access()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_role TEXT;
BEGIN
  -- Get the authenticated user's ID
  v_user_id := auth.uid();
  
  -- Return false if no authenticated user
  IF v_user_id IS NULL THEN
    RETURN json_build_object('access', false);
  END IF;
  
  -- Check if user has super_admin role in user_roles table
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id 
    AND role = 'super_admin'::app_role
  ) INTO v_is_admin;
  
  -- If not super_admin, also check admin_users table for backwards compatibility
  IF NOT v_is_admin THEN
    SELECT EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = v_user_id 
      AND is_active = true
      AND role IN ('super_admin', 'admin')
    ) INTO v_is_admin;
    
    IF v_is_admin THEN
      SELECT role::TEXT INTO v_role
      FROM public.admin_users
      WHERE user_id = v_user_id AND is_active = true
      LIMIT 1;
    END IF;
  ELSE
    v_role := 'super_admin';
  END IF;
  
  RETURN json_build_object('access', v_is_admin, 'role', v_role);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_platform_admin_access() TO authenticated;
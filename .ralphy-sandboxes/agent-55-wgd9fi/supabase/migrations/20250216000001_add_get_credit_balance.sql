-- Add get_credit_balance RPC function
-- This function was missing from initial migrations but is required by the frontend credit service.

CREATE OR REPLACE FUNCTION public.get_credit_balance(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_balance INTEGER;
  v_user_tenant_id UUID;
  v_is_super_admin BOOLEAN;
BEGIN
  -- 1. Check permissions
  -- Check if user is super admin
  SELECT EXISTS (
      SELECT 1 FROM public.super_admin_users WHERE id = auth.uid()::text::uuid
  ) INTO v_is_super_admin;
  
  IF NOT v_is_super_admin THEN
      -- Check if user belongs to the requested tenant
      SELECT tenant_id INTO v_user_tenant_id 
      FROM public.tenant_users 
      WHERE id = auth.uid()::text::uuid;
      
      IF v_user_tenant_id IS NULL OR v_user_tenant_id != p_tenant_id THEN
          -- Return 0 or raise error? 
          -- For UI smoothness, we might return 0, but raising error helps debugging.
          -- Let's check RLS policy style: usually fail silent or error.
          -- Given it's a specific RPC call for a specific tenant, unauthorized is appropriate.
          RAISE EXCEPTION 'Unauthorized access to credit balance';
      END IF;
  END IF;

  -- 2. Get balance
  SELECT balance INTO v_balance 
  FROM public.tenant_credits 
  WHERE tenant_id = p_tenant_id;
  
  -- Return 0 if no record found (though trigger should create one)
  RETURN COALESCE(v_balance, 0);
END;
$$;

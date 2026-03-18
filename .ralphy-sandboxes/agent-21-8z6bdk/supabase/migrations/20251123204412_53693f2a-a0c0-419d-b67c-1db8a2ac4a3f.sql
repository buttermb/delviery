-- Fix SECURITY DEFINER functions missing SET search_path
-- Security Issue: Functions without SET search_path can be exploited via search_path manipulation

-- Fix create_super_admin_with_password function
CREATE OR REPLACE FUNCTION create_super_admin_with_password(
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_password TEXT
) RETURNS UUID 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- For now, we'll use a simple approach and update to use proper PBKDF2 via edge function
  -- Insert with a placeholder hash - the edge function will handle hashing
  INSERT INTO super_admin_users (email, first_name, last_name, password_hash, role, status)
  VALUES (
    lower(p_email),
    p_first_name,
    p_last_name,
    encode(digest(p_password || 'temp_salt', 'sha256'), 'hex'), -- Temporary hash
    'super_admin',
    'active'
  )
  ON CONFLICT (email) DO UPDATE
  SET password_hash = encode(digest(p_password || 'temp_salt', 'sha256'), 'hex'),
      updated_at = now()
  RETURNING id INTO v_admin_id;
  
  RETURN v_admin_id;
END;
$$;

-- Fix increment_runner_deliveries function
CREATE OR REPLACE FUNCTION public.increment_runner_deliveries(p_runner_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.wholesale_runners
  SET 
    total_deliveries = total_deliveries + 1,
    updated_at = NOW()
  WHERE id = p_runner_id;
END;
$$;

-- Add documentation comments
COMMENT ON FUNCTION create_super_admin_with_password(TEXT, TEXT, TEXT, TEXT) IS 
  'SECURITY DEFINER function for creating super admin accounts. SET search_path prevents search_path manipulation attacks.';

COMMENT ON FUNCTION public.increment_runner_deliveries(UUID) IS 
  'SECURITY DEFINER function to increment runner delivery count. SET search_path prevents search_path manipulation attacks.';
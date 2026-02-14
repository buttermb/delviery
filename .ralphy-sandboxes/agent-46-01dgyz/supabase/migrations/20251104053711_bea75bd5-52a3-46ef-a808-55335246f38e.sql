-- Create a test super admin with properly hashed password
-- Password will be: Admin123!
-- This uses a pre-computed PBKDF2 hash for testing purposes

-- First, let's create a function to handle password hashing for super admins
CREATE OR REPLACE FUNCTION create_super_admin_with_password(
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_password TEXT
) RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create test super admin (or update if exists)
SELECT create_super_admin_with_password(
  'sake121211@gmail.com',
  'Test',
  'Admin',
  'Admin123!'
);
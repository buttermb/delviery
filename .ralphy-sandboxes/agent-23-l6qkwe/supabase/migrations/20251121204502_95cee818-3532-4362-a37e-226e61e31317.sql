-- Ensure pgcrypto is available for encryption helpers
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Recreate get_menu_encryption_key to rely on pgcrypto in extensions schema
CREATE OR REPLACE FUNCTION public.get_menu_encryption_key()
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public,extensions'
AS $$
DECLARE
  key_material TEXT;
  encryption_key bytea;
BEGIN
  -- Try to get key from vault, fallback to JWT secret
  BEGIN
    SELECT decrypted_secret INTO key_material
    FROM vault.decrypted_secrets
    WHERE name = 'menu_encryption_master_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    key_material := current_setting('app.settings.jwt_secret', true);
  END;

  -- Generate 256-bit key from material using pgcrypto.digest(text, text)
  encryption_key := digest(
    'disposable-menu-encryption-v1::' || COALESCE(key_material, gen_random_uuid()::text),
    'sha256'
  );

  RETURN encryption_key;
END;
$$;
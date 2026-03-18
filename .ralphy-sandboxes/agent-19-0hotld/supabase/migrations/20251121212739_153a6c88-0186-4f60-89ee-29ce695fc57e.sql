-- Fix gen_random_bytes schema qualification
-- The gen_random_bytes function needs to be explicitly qualified with the extensions schema

CREATE OR REPLACE FUNCTION public.encrypt_menu_text(plaintext text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public,extensions'
AS $$
DECLARE
  encryption_key bytea;
  iv bytea;
  encrypted_data bytea;
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;

  encryption_key := public.get_menu_encryption_key();
  iv := extensions.gen_random_bytes(16);  -- ✅ Schema-qualified
  
  encrypted_data := encrypt_iv(
    convert_to(plaintext, 'UTF8'),
    encryption_key,
    iv,
    'aes-cbc/pad:pkcs'
  );
  
  RETURN iv || encrypted_data;
END;
$$;
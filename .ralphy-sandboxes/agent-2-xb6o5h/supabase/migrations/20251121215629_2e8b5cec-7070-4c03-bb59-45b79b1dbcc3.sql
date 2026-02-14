-- Fix encrypt_iv and decrypt_iv function calls by schema-qualifying them
-- This resolves "function encrypt_iv(bytea, bytea, bytea, unknown) does not exist" error

-- ============================================================================
-- Fix encrypt_menu_text to use extensions.encrypt_iv
-- ============================================================================
CREATE OR REPLACE FUNCTION public.encrypt_menu_text(plaintext text)
 RETURNS bytea
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public,extensions'
AS $function$
DECLARE
  encryption_key bytea;
  iv bytea;
  encrypted_data bytea;
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;

  encryption_key := public.get_menu_encryption_key();
  iv := extensions.gen_random_bytes(16);
  
  -- ✅ Schema-qualified encrypt_iv call
  encrypted_data := extensions.encrypt_iv(
    convert_to(plaintext, 'UTF8'),
    encryption_key,
    iv,
    'aes-cbc/pad:pkcs'
  );
  
  RETURN iv || encrypted_data;
END;
$function$;

-- ============================================================================
-- Fix decrypt_menu_text to use extensions.decrypt_iv
-- ============================================================================
CREATE OR REPLACE FUNCTION public.decrypt_menu_text(encrypted_data bytea)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public,extensions'
AS $function$
DECLARE
  encryption_key bytea;
  iv bytea;
  ciphertext bytea;
  decrypted_data bytea;
BEGIN
  IF encrypted_data IS NULL THEN
    RETURN NULL;
  END IF;

  encryption_key := public.get_menu_encryption_key();
  iv := substring(encrypted_data from 1 for 16);
  ciphertext := substring(encrypted_data from 17);
  
  -- ✅ Schema-qualified decrypt_iv call
  decrypted_data := extensions.decrypt_iv(
    ciphertext,
    encryption_key,
    iv,
    'aes-cbc/pad:pkcs'
  );
  
  RETURN convert_from(decrypted_data, 'UTF8');
END;
$function$;
-- Fix menu encryption functions to access pgcrypto in extensions schema
-- This addresses the "encryption failed: null" error by ensuring crypto functions are accessible

-- Fix get_menu_encryption_key to access pgcrypto
CREATE OR REPLACE FUNCTION public.get_menu_encryption_key()
 RETURNS bytea
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public,extensions'
AS $function$
DECLARE
  key_material TEXT;
  encryption_key bytea;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO key_material
    FROM vault.decrypted_secrets
    WHERE name = 'menu_encryption_master_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    key_material := current_setting('app.settings.jwt_secret', true);
  END;

  encryption_key := digest(
    'disposable-menu-encryption-v1::' || COALESCE(key_material, gen_random_uuid()::text),
    'sha256'
  );

  RETURN encryption_key;
END;
$function$;

-- Fix encrypt_menu_text to access pgcrypto
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

  encryption_key := get_menu_encryption_key();
  iv := gen_random_bytes(16);
  
  encrypted_data := encrypt_iv(
    convert_to(plaintext, 'UTF8'),
    encryption_key,
    iv,
    'aes-cbc/pad:pkcs'
  );
  
  RETURN iv || encrypted_data;
END;
$function$;

-- Fix decrypt_menu_text to access pgcrypto
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

  encryption_key := get_menu_encryption_key();
  iv := substring(encrypted_data from 1 for 16);
  ciphertext := substring(encrypted_data from 17);
  
  decrypted_data := decrypt_iv(
    ciphertext,
    encryption_key,
    iv,
    'aes-cbc/pad:pkcs'
  );
  
  RETURN convert_from(decrypted_data, 'UTF8');
END;
$function$;

-- Fix encrypt_menu_jsonb to access pgcrypto
CREATE OR REPLACE FUNCTION public.encrypt_menu_jsonb(plaintext jsonb)
 RETURNS bytea
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public,extensions'
AS $function$
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN encrypt_menu_text(plaintext::text);
END;
$function$;

-- Fix decrypt_menu_jsonb to access pgcrypto
CREATE OR REPLACE FUNCTION public.decrypt_menu_jsonb(encrypted_data bytea)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public,extensions'
AS $function$
DECLARE
  decrypted_text TEXT;
BEGIN
  IF encrypted_data IS NULL THEN
    RETURN NULL;
  END IF;
  
  decrypted_text := decrypt_menu_text(encrypted_data);
  
  IF decrypted_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN decrypted_text::jsonb;
END;
$function$;

-- Fix encrypt_menu_numeric to access pgcrypto
CREATE OR REPLACE FUNCTION public.encrypt_menu_numeric(plaintext numeric)
 RETURNS bytea
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public,extensions'
AS $function$
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN encrypt_menu_text(plaintext::text);
END;
$function$;

-- Fix decrypt_menu_numeric to access pgcrypto
CREATE OR REPLACE FUNCTION public.decrypt_menu_numeric(encrypted_data bytea)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public,extensions'
AS $function$
DECLARE
  decrypted_text TEXT;
BEGIN
  IF encrypted_data IS NULL THEN
    RETURN NULL;
  END IF;
  
  decrypted_text := decrypt_menu_text(encrypted_data);
  
  IF decrypted_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN decrypted_text::numeric;
END;
$function$;

-- Fix encrypt_disposable_menu with proper WHERE clause and error propagation
CREATE OR REPLACE FUNCTION public.encrypt_disposable_menu(menu_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public,extensions'
AS $function$
BEGIN
  -- Encrypt menu data
  UPDATE public.disposable_menus
  SET
    encrypted_name = encrypt_menu_text(name),
    encrypted_description = encrypt_menu_text(description),
    encrypted_security_settings = encrypt_menu_jsonb(security_settings),
    encrypted_appearance_settings = encrypt_menu_jsonb(appearance_settings),
    encrypted_min_order_quantity = encrypt_menu_numeric(min_order_quantity),
    encrypted_max_order_quantity = encrypt_menu_numeric(max_order_quantity),
    is_encrypted = true,
    encryption_version = 1
  WHERE id = menu_id;
  
  -- Encrypt product prices - FIX: properly qualified WHERE clause
  UPDATE public.disposable_menu_products
  SET
    encrypted_custom_price = encrypt_menu_numeric(custom_price),
    is_encrypted = true
  WHERE public.disposable_menu_products.menu_id = encrypt_disposable_menu.menu_id;
  
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  -- Fail loudly with detailed error message
  RAISE EXCEPTION 'Failed to encrypt menu %: %', menu_id, SQLERRM;
END;
$function$;

-- Add helpful comment
COMMENT ON FUNCTION public.encrypt_disposable_menu(uuid) IS 'Encrypts disposable menu data and products. Requires pgcrypto extension in search_path.';
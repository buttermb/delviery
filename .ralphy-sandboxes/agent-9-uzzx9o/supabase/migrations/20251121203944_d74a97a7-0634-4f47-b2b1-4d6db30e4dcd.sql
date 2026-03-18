-- Create encryption helper functions for disposable menus
-- These functions handle AES-256 encryption/decryption of menu data

-- Function to get encryption key (with fallback)
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

  -- Generate 256-bit key from material
  encryption_key := digest(
    'disposable-menu-encryption-v1::' || COALESCE(key_material, gen_random_uuid()::text),
    'sha256'
  );

  RETURN encryption_key;
END;
$$;

-- Encrypt text fields
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
$$;

-- Decrypt text fields
CREATE OR REPLACE FUNCTION public.decrypt_menu_text(encrypted_data bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public,extensions'
AS $$
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
$$;

-- Encrypt numeric fields
CREATE OR REPLACE FUNCTION public.encrypt_menu_numeric(plaintext numeric)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public,extensions'
AS $$
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN encrypt_menu_text(plaintext::text);
END;
$$;

-- Decrypt numeric fields
CREATE OR REPLACE FUNCTION public.decrypt_menu_numeric(encrypted_data bytea)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public,extensions'
AS $$
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
$$;

-- Encrypt JSONB fields
CREATE OR REPLACE FUNCTION public.encrypt_menu_jsonb(plaintext jsonb)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public,extensions'
AS $$
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN encrypt_menu_text(plaintext::text);
END;
$$;

-- Decrypt JSONB fields
CREATE OR REPLACE FUNCTION public.decrypt_menu_jsonb(encrypted_data bytea)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public,extensions'
AS $$
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
$$;

-- Main function to encrypt a disposable menu
CREATE OR REPLACE FUNCTION public.encrypt_disposable_menu(menu_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public,extensions'
AS $$
BEGIN
  -- Encrypt menu data using fully qualified helper functions
  UPDATE public.disposable_menus
  SET
    encrypted_name = public.encrypt_menu_text(name::text),
    encrypted_description = public.encrypt_menu_text(description::text),
    encrypted_security_settings = public.encrypt_menu_jsonb(security_settings),
    encrypted_appearance_settings = public.encrypt_menu_jsonb(appearance_settings),
    encrypted_min_order_quantity = public.encrypt_menu_numeric(min_order_quantity),
    encrypted_max_order_quantity = public.encrypt_menu_numeric(max_order_quantity),
    is_encrypted = true,
    encryption_version = 1
  WHERE id = menu_id;
  
  -- Encrypt product prices
  UPDATE public.disposable_menu_products
  SET
    encrypted_custom_price = public.encrypt_menu_numeric(custom_price),
    is_encrypted = true
  WHERE public.disposable_menu_products.menu_id = encrypt_disposable_menu.menu_id;
  
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to encrypt menu %: %', menu_id, SQLERRM;
END;
$$;
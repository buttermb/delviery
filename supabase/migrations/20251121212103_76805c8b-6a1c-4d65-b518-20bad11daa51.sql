-- ============================================================================
-- FIX: Schema-qualify internal function calls in encryption functions
-- ============================================================================
-- This migration ensures all internal function calls use explicit schema
-- qualification to prevent "function does not exist" errors
-- ============================================================================

-- Phase 1: Update encrypt_menu_text() with schema-qualified call
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

  -- ✅ Schema-qualified call to get_menu_encryption_key
  encryption_key := public.get_menu_encryption_key();
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

-- Phase 2: Update encrypt_menu_numeric() with schema-qualified call
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
  
  -- ✅ Schema-qualified call to encrypt_menu_text
  RETURN public.encrypt_menu_text(plaintext::text);
END;
$$;

-- Phase 3: Update encrypt_menu_jsonb() with schema-qualified call
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
  
  -- ✅ Schema-qualified call to encrypt_menu_text
  RETURN public.encrypt_menu_text(plaintext::text);
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION public.encrypt_menu_text IS 'Encrypts text using AES-256-CBC with schema-qualified internal calls';
COMMENT ON FUNCTION public.encrypt_menu_numeric IS 'Encrypts numeric values by delegating to encrypt_menu_text with schema qualification';
COMMENT ON FUNCTION public.encrypt_menu_jsonb IS 'Encrypts JSONB by delegating to encrypt_menu_text with schema qualification';
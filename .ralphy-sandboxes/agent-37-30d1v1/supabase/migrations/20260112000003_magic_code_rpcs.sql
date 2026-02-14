-- Magic Code RPCs for Storefront Login

-- 1. Function to Request Magic Code
CREATE OR REPLACE FUNCTION request_magic_code(p_store_id UUID, p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Normalize email
  p_email := lower(trim(p_email));

  -- Generate 6-digit code
  v_code := floor(random() * (999999 - 100000 + 1) + 100000)::text;
  v_expires_at := now() + interval '15 minutes';

  -- Upsert: Invalidate old codes for this email/store by deleting them
  DELETE FROM public.marketplace_magic_codes
  WHERE store_id = p_store_id AND email = p_email;

  -- Insert new code
  INSERT INTO public.marketplace_magic_codes (store_id, email, code, expires_at)
  VALUES (p_store_id, p_email, v_code, v_expires_at);

  -- Return code so frontend can show it in toast (Demo Mode)
  -- In production, trigger an Edge Function to send email instead
  RETURN v_code;
END;
$$;

-- 2. Function to Verify Magic Code
CREATE OR REPLACE FUNCTION verify_magic_code(p_store_id UUID, p_email TEXT, p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record RECORD;
  v_customer JSON;
BEGIN
  -- Normalize email
  p_email := lower(trim(p_email));

  -- Check code existence and expiry
  SELECT * INTO v_record
  FROM public.marketplace_magic_codes
  WHERE store_id = p_store_id
    AND email = p_email
    AND code = p_code
    AND expires_at > now();

  IF v_record.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired login code';
  END IF;

  -- Consume code (delete it so it can't be used again)
  DELETE FROM public.marketplace_magic_codes WHERE id = v_record.id;

  -- Retrieve Customer Record
  SELECT to_json(c.*) INTO v_customer
  FROM public.marketplace_customers c
  WHERE c.store_id = p_store_id AND c.email = p_email
  LIMIT 1;

  -- Return customer (or null if not found, frontend manages "Account not found")
  RETURN v_customer;
END;
$$;

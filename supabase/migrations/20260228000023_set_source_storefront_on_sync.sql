-- ============================================================================
-- Set source='storefront' on synced marketplace customers
--
-- Fixes: sync trigger and upsert RPC were not setting the `source` column
-- when creating/updating customers from storefront orders.
-- Also backfills existing storefront customers that have referral_source='storefront'
-- but source still defaulted to 'manual'.
-- ============================================================================

-- 1. Update the sync trigger function to also set source='storefront'
CREATE OR REPLACE FUNCTION sync_marketplace_customer_to_customers()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_account_id UUID;
  v_existing_customer_id UUID;
BEGIN
  -- Get tenant_id from the store's marketplace_profiles
  SELECT mp.tenant_id INTO v_tenant_id
  FROM public.marketplace_profiles mp
  WHERE mp.id = NEW.store_id;

  IF v_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get account_id for this tenant
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE tenant_id = v_tenant_id
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if customer already exists by email + tenant_id
  SELECT id INTO v_existing_customer_id
  FROM public.customers
  WHERE tenant_id = v_tenant_id
    AND email = lower(NEW.email)
    AND deleted_at IS NULL;

  IF v_existing_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET
      first_name = COALESCE(NEW.first_name, first_name),
      last_name = COALESCE(NEW.last_name, last_name),
      phone = COALESCE(NEW.phone, phone),
      marketplace_customer_id = NEW.id,
      source = 'storefront',
      referral_source = 'storefront',
      updated_at = NOW()
    WHERE id = v_existing_customer_id;
  ELSE
    INSERT INTO public.customers (
      account_id, tenant_id, first_name, last_name, email, phone,
      customer_type, status, loyalty_points, loyalty_tier, total_spent,
      referral_source, source, marketplace_customer_id,
      created_at, updated_at
    ) VALUES (
      v_account_id, v_tenant_id,
      COALESCE(NEW.first_name, 'Guest'), COALESCE(NEW.last_name, ''),
      lower(NEW.email), NEW.phone,
      'recreational', 'active', 0, 'bronze', 0,
      'storefront', 'storefront', NEW.id,
      NOW(), NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Update upsert_customer_on_checkout to accept and set source
CREATE OR REPLACE FUNCTION upsert_customer_on_checkout(
  p_tenant_id UUID,
  p_name TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_preferred_contact TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_order_total NUMERIC DEFAULT 0
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_account_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  SELECT id INTO v_account_id
  FROM accounts
  WHERE tenant_id = p_tenant_id
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'No account found for tenant %', p_tenant_id
      USING ERRCODE = 'P0002';
  END IF;

  v_first_name := split_part(COALESCE(p_name, ''), ' ', 1);
  v_last_name  := NULLIF(trim(substring(COALESCE(p_name, '') FROM length(v_first_name) + 2)), '');

  IF v_first_name = '' THEN
    v_first_name := 'Unknown';
  END IF;
  IF v_last_name IS NULL THEN
    v_last_name := '';
  END IF;

  -- Try to find by phone + tenant_id
  IF p_phone IS NOT NULL AND p_phone <> '' THEN
    SELECT id INTO v_customer_id
    FROM customers
    WHERE phone = p_phone
      AND tenant_id = p_tenant_id
    LIMIT 1;
  END IF;

  -- Fallback to email + tenant_id
  IF v_customer_id IS NULL AND p_email IS NOT NULL AND p_email <> '' THEN
    SELECT id INTO v_customer_id
    FROM customers
    WHERE email = p_email
      AND tenant_id = p_tenant_id
    LIMIT 1;
  END IF;

  IF v_customer_id IS NOT NULL THEN
    UPDATE customers
    SET first_name        = v_first_name,
        last_name         = v_last_name,
        email             = COALESCE(NULLIF(p_email, ''), email),
        last_purchase_at  = NOW(),
        total_orders      = COALESCE(total_orders, 0) + 1,
        total_spent       = COALESCE(total_spent, 0) + COALESCE(p_order_total, 0),
        preferred_contact = COALESCE(p_preferred_contact, preferred_contact),
        address           = COALESCE(NULLIF(p_address, ''), address),
        source            = COALESCE(NULLIF(source, 'manual'), 'storefront'),
        referral_source   = COALESCE(referral_source, 'storefront'),
        updated_at        = NOW()
    WHERE id = v_customer_id;
  ELSE
    INSERT INTO customers (
      account_id, tenant_id, first_name, last_name, email, phone,
      preferred_contact, address, total_orders, total_spent, last_purchase_at,
      source, referral_source
    )
    VALUES (
      v_account_id, p_tenant_id, v_first_name, v_last_name,
      NULLIF(p_email, ''), NULLIF(p_phone, ''),
      p_preferred_contact, NULLIF(p_address, ''),
      1, COALESCE(p_order_total, 0), NOW(),
      'storefront', 'storefront'
    )
    RETURNING id INTO v_customer_id;
  END IF;

  RETURN v_customer_id;
END;
$$;

-- 3. Backfill: set source='storefront' for existing customers that came from storefront
UPDATE public.customers
SET source = 'storefront'
WHERE (source IS NULL OR source = 'manual')
  AND (
    referral_source = 'storefront'
    OR marketplace_customer_id IS NOT NULL
  );

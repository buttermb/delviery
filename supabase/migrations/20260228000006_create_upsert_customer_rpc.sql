-- Add missing columns to customers table for checkout upsert
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_contact TEXT;

-- Create index for phone + tenant_id lookup (used by upsert function)
CREATE INDEX IF NOT EXISTS idx_customers_phone_tenant
  ON customers(phone, tenant_id)
  WHERE phone IS NOT NULL;

-- Upsert customer on checkout.
-- Finds by phone + tenant_id (fallback: email + tenant_id).
-- If found: updates name, email, last_purchase_at, increments total_orders, adds to total_spent.
-- If not found: inserts new customer with total_orders = 1, total_spent = order_total.
-- Returns the customer id.

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
  -- Resolve account_id from tenant_id (required FK on customers table)
  SELECT id INTO v_account_id
  FROM accounts
  WHERE tenant_id = p_tenant_id
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'No account found for tenant %', p_tenant_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Parse name into first/last
  v_first_name := split_part(COALESCE(p_name, ''), ' ', 1);
  v_last_name  := NULLIF(trim(substring(COALESCE(p_name, '') FROM length(v_first_name) + 2)), '');

  -- Default last_name to empty string if null (NOT NULL column)
  IF v_first_name = '' THEN
    v_first_name := 'Unknown';
  END IF;
  IF v_last_name IS NULL THEN
    v_last_name := '';
  END IF;

  -- Step 1: Try to find by phone + tenant_id
  IF p_phone IS NOT NULL AND p_phone <> '' THEN
    SELECT id INTO v_customer_id
    FROM customers
    WHERE phone = p_phone
      AND tenant_id = p_tenant_id
    LIMIT 1;
  END IF;

  -- Step 2: Fallback to email + tenant_id
  IF v_customer_id IS NULL AND p_email IS NOT NULL AND p_email <> '' THEN
    SELECT id INTO v_customer_id
    FROM customers
    WHERE email = p_email
      AND tenant_id = p_tenant_id
    LIMIT 1;
  END IF;

  -- Step 3: Update existing or insert new
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
        updated_at        = NOW()
    WHERE id = v_customer_id;
  ELSE
    INSERT INTO customers (
      account_id, tenant_id, first_name, last_name, email, phone,
      preferred_contact, address, total_orders, total_spent, last_purchase_at
    )
    VALUES (
      v_account_id, p_tenant_id, v_first_name, v_last_name,
      NULLIF(p_email, ''), NULLIF(p_phone, ''),
      p_preferred_contact, NULLIF(p_address, ''),
      1, COALESCE(p_order_total, 0), NOW()
    )
    RETURNING id INTO v_customer_id;
  END IF;

  RETURN v_customer_id;
END;
$$;

COMMENT ON FUNCTION upsert_customer_on_checkout(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC) IS
  'Upserts a customer during checkout. Finds by phone+tenant, falls back to email+tenant. Returns customer_id.';

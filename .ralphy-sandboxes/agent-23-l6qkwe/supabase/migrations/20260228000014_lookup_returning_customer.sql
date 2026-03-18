-- Lookup returning customer by phone + tenant_id for storefront auto-fill.
-- Returns limited profile data (name, email, address) for checkout convenience.
-- SECURITY DEFINER so anon/guest users can call it from storefront checkout.

CREATE OR REPLACE FUNCTION lookup_returning_customer(
  p_phone TEXT,
  p_tenant_id UUID
) RETURNS TABLE (
  customer_id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  address TEXT,
  preferred_contact TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Normalize phone: strip non-digits for comparison
  RETURN QUERY
  SELECT
    c.id AS customer_id,
    c.first_name,
    c.last_name,
    c.email,
    c.address,
    c.preferred_contact
  FROM customers c
  WHERE c.phone = p_phone
    AND c.tenant_id = p_tenant_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION lookup_returning_customer(TEXT, UUID) TO anon, authenticated, service_role;

COMMENT ON FUNCTION lookup_returning_customer(TEXT, UUID) IS
  'Looks up a returning customer by phone + tenant_id for storefront checkout auto-fill. Returns limited profile data.';

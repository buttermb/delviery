-- Grant execute permissions on upsert_customer_on_checkout
-- The edge function calls this via service_role, but the client-side fallback
-- checkout path also needs to call it via anon/authenticated roles.

GRANT EXECUTE ON FUNCTION public.upsert_customer_on_checkout(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC)
  TO anon, authenticated, service_role;

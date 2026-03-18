-- Check if a marketplace store has Stripe payment configured
-- Used by storefront checkout to hide the card option when Stripe keys are missing.
-- SECURITY DEFINER so anonymous (guest) users can call it.

CREATE OR REPLACE FUNCTION is_store_stripe_configured(p_store_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_configured boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM marketplace_stores ms
    JOIN accounts a ON a.tenant_id = ms.tenant_id
    JOIN account_settings ast ON ast.account_id = a.id
    WHERE ms.id = p_store_id
      AND (ast.integration_settings->>'stripe_secret_key') IS NOT NULL
      AND (ast.integration_settings->>'stripe_secret_key') <> ''
      AND (ast.integration_settings->>'stripe_publishable_key') IS NOT NULL
      AND (ast.integration_settings->>'stripe_publishable_key') <> ''
  ) INTO v_configured;

  RETURN v_configured;
END;
$$;

-- Allow anonymous storefront users to call this
GRANT EXECUTE ON FUNCTION is_store_stripe_configured(UUID) TO anon;
GRANT EXECUTE ON FUNCTION is_store_stripe_configured(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_store_stripe_configured(UUID) TO service_role;

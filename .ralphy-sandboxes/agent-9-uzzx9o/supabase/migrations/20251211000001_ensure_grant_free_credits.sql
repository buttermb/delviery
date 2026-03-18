-- Ensure grant_free_credits function exists
-- This function is critical for the Free Tier signup flow.
-- It is idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.grant_free_credits(
  p_tenant_id UUID,
  p_amount INTEGER DEFAULT 500
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Get or create credit record
  -- Note: existing columns from V3 schema are assumed
  INSERT INTO public.tenant_credits (tenant_id, balance, lifetime_earned)
  VALUES (p_tenant_id, p_amount, p_amount)
  ON CONFLICT (tenant_id) DO UPDATE SET
    balance = tenant_credits.balance + p_amount,
    lifetime_earned = tenant_credits.lifetime_earned + p_amount,
    last_free_grant_at = now(),
    -- Simplify assuming standard columns if v3 specific ones are missing?
    -- No, best to assume correct state or fail loudly so we know.
    -- But to be safe against partial migrations, we can use IF EXISTS via dynamic SQL or just standard update.
    -- Standard update is best.
    updated_at = now()
  RETURNING balance INTO v_new_balance;
  
  -- Record transaction
  INSERT INTO public.credit_transactions (
    tenant_id,
    amount,
    balance_after,
    transaction_type,
    description
  ) VALUES (
    p_tenant_id,
    p_amount,
    v_new_balance,
    'free_grant',
    'Monthly free credit grant'
  );
  
  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

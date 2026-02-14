-- ============================================================================
-- Credit System Hardening - Idempotency Constraints
-- Prevents duplicate transactions via database-level constraints
-- ============================================================================

-- Step 1: Add unique constraint for idempotency on credit_transactions
-- Prevents the same action from being recorded twice for the same reference
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_idempotency 
ON public.credit_transactions(tenant_id, action_type, reference_id)
WHERE reference_id IS NOT NULL;

-- Step 2: Add check constraint to prevent negative balances
-- Final safety net - database will reject any update that would go negative
ALTER TABLE public.tenant_credits 
ADD CONSTRAINT chk_tenant_credits_non_negative_balance 
CHECK (balance >= 0);

-- Step 3: Add rate limiting columns for abuse prevention
ALTER TABLE public.tenant_credits 
ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.tenant_credits 
ADD COLUMN IF NOT EXISTS actions_this_minute INTEGER DEFAULT 0;

-- Step 4: Create function to check rate limits (100 actions per minute max)
CREATE OR REPLACE FUNCTION public.check_credit_rate_limit(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_action TIMESTAMPTZ;
  v_actions_count INTEGER;
  v_one_minute_ago TIMESTAMPTZ := NOW() - INTERVAL '1 minute';
BEGIN
  -- Get current rate limit state
  SELECT last_action_at, actions_this_minute 
  INTO v_last_action, v_actions_count
  FROM public.tenant_credits
  WHERE tenant_id = p_tenant_id;

  -- If last action was more than a minute ago, reset counter
  IF v_last_action IS NULL OR v_last_action < v_one_minute_ago THEN
    UPDATE public.tenant_credits
    SET actions_this_minute = 1, last_action_at = NOW()
    WHERE tenant_id = p_tenant_id;
    
    RETURN jsonb_build_object('allowed', true, 'remaining', 99);
  END IF;

  -- Check if under limit (100 actions per minute)
  IF v_actions_count >= 100 THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'remaining', 0,
      'reset_at', v_last_action + INTERVAL '1 minute'
    );
  END IF;

  -- Increment counter
  UPDATE public.tenant_credits
  SET actions_this_minute = actions_this_minute + 1, last_action_at = NOW()
  WHERE tenant_id = p_tenant_id;

  RETURN jsonb_build_object('allowed', true, 'remaining', 99 - v_actions_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_credit_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_credit_rate_limit TO service_role;

-- Step 5: Add index for faster balance lookups
CREATE INDEX IF NOT EXISTS idx_tenant_credits_balance 
ON public.tenant_credits(tenant_id, balance);

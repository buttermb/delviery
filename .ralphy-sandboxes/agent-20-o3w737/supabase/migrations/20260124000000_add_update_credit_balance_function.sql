-- ============================================================================
-- Add update_credit_balance function
-- Atomically updates tenant_credits.balance and creates a credit_transactions
-- row with balance_before and balance_after tracking.
-- ============================================================================

-- Add balance_before column to credit_transactions if not exists
ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS balance_before INTEGER;

-- ============================================================================
-- update_credit_balance: Atomic credit balance update with transaction logging
-- ============================================================================
-- Accepts user_id, tenant_id, amount, transaction_type, description,
-- reference_type, reference_id. Atomically updates the balance and creates
-- a transaction record. Raises exception for insufficient credits on usage type.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_credit_balance(
  p_user_id UUID,
  p_tenant_id UUID,
  p_amount INTEGER,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Validate transaction_type
  IF p_transaction_type NOT IN ('free_grant', 'purchase', 'usage', 'refund', 'bonus', 'adjustment') THEN
    RAISE EXCEPTION 'Invalid transaction_type: %. Must be one of: free_grant, purchase, usage, refund, bonus, adjustment', p_transaction_type;
  END IF;

  -- Validate amount
  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'Amount must be a non-zero integer';
  END IF;

  -- For usage type, amount should be positive (we subtract it internally)
  -- For purchase/grant types, amount should be positive (we add it)
  IF p_transaction_type = 'usage' AND p_amount < 0 THEN
    RAISE EXCEPTION 'Amount for usage transactions must be positive (credits to deduct)';
  END IF;

  -- Lock the tenant_credits row for atomic update
  SELECT balance INTO v_current_balance
  FROM public.tenant_credits
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  -- If no credit record exists, create one with 0 balance
  IF v_current_balance IS NULL THEN
    INSERT INTO public.tenant_credits (tenant_id, balance, lifetime_earned, lifetime_spent)
    VALUES (p_tenant_id, 0, 0, 0)
    ON CONFLICT (tenant_id) DO NOTHING;

    -- Re-read after insert (in case of race condition with ON CONFLICT)
    SELECT balance INTO v_current_balance
    FROM public.tenant_credits
    WHERE tenant_id = p_tenant_id
    FOR UPDATE;
  END IF;

  -- Calculate new balance based on transaction type
  IF p_transaction_type = 'usage' THEN
    -- Usage: deduct credits
    v_new_balance := v_current_balance - p_amount;

    -- Check for insufficient credits
    IF v_new_balance < 0 THEN
      RAISE EXCEPTION 'Insufficient credits. Current balance: %, required: %', v_current_balance, p_amount;
    END IF;
  ELSIF p_transaction_type IN ('purchase', 'free_grant', 'bonus', 'refund') THEN
    -- Credit-adding types: add to balance
    v_new_balance := v_current_balance + ABS(p_amount);
  ELSE
    -- Adjustment: can be positive or negative
    v_new_balance := v_current_balance + p_amount;

    -- Even adjustments cannot go below zero
    IF v_new_balance < 0 THEN
      RAISE EXCEPTION 'Adjustment would result in negative balance. Current balance: %, adjustment: %', v_current_balance, p_amount;
    END IF;
  END IF;

  -- Update the balance
  UPDATE public.tenant_credits
  SET
    balance = v_new_balance,
    lifetime_spent = CASE
      WHEN p_transaction_type = 'usage' THEN lifetime_spent + p_amount
      ELSE lifetime_spent
    END,
    lifetime_earned = CASE
      WHEN p_transaction_type IN ('purchase', 'free_grant', 'bonus', 'refund') THEN lifetime_earned + ABS(p_amount)
      ELSE lifetime_earned
    END,
    updated_at = now()
  WHERE tenant_id = p_tenant_id;

  -- Record the transaction with balance_before and balance_after
  INSERT INTO public.credit_transactions (
    tenant_id,
    amount,
    balance_before,
    balance_after,
    transaction_type,
    reference_id,
    reference_type,
    description,
    metadata
  ) VALUES (
    p_tenant_id,
    CASE
      WHEN p_transaction_type = 'usage' THEN -p_amount
      WHEN p_transaction_type IN ('purchase', 'free_grant', 'bonus', 'refund') THEN ABS(p_amount)
      ELSE p_amount
    END,
    v_current_balance,
    v_new_balance,
    p_transaction_type,
    p_reference_id,
    p_reference_type,
    COALESCE(p_description, p_transaction_type || ' transaction'),
    jsonb_build_object('user_id', p_user_id)
  );

  -- Return the new balance
  RETURN v_new_balance;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_credit_balance(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_credit_balance(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, UUID) TO service_role;

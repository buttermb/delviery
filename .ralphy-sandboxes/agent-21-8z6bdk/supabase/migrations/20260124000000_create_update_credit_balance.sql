-- ============================================================================
-- CREATE update_credit_balance FUNCTION
-- ============================================================================
-- Atomically updates credit balance and creates a transaction record.
-- Used by the credits-use edge function and other features that consume credits.
-- Supports types: purchase, usage, refund, expiration, bonus, adjustment, transfer_in, transfer_out
-- For 'usage' type, raises exception if insufficient balance.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_credit_balance(
  p_user_id UUID,
  p_tenant_id UUID,
  p_amount INTEGER,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_transaction_id UUID;
  v_idempotency_key TEXT;
  v_existing_tx UUID;
BEGIN
  -- Validate transaction_type
  IF p_transaction_type NOT IN ('purchase', 'usage', 'refund', 'expiration', 'bonus', 'adjustment', 'transfer_in', 'transfer_out') THEN
    RAISE EXCEPTION 'Invalid transaction_type: %. Must be one of: purchase, usage, refund, expiration, bonus, adjustment, transfer_in, transfer_out', p_transaction_type;
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive. Got: %', p_amount;
  END IF;

  -- Idempotency check using reference_id if provided
  IF p_reference_id IS NOT NULL THEN
    SELECT id INTO v_existing_tx
    FROM public.credit_transactions
    WHERE tenant_id = p_tenant_id
      AND reference_id = p_reference_id
      AND transaction_type = p_transaction_type
    LIMIT 1;

    IF v_existing_tx IS NOT NULL THEN
      -- Already processed, return current balance
      SELECT balance INTO v_current_balance
      FROM public.tenant_credits
      WHERE tenant_id = p_tenant_id;

      RETURN jsonb_build_object(
        'success', true,
        'new_balance', COALESCE(v_current_balance, 0),
        'transaction_id', v_existing_tx,
        'duplicate', true,
        'message', 'Transaction already processed'
      );
    END IF;
  END IF;

  -- Get current balance with row lock to prevent race conditions
  SELECT balance INTO v_current_balance
  FROM public.tenant_credits
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  -- If no credit record exists, create one
  IF v_current_balance IS NULL THEN
    INSERT INTO public.tenant_credits (tenant_id, balance, lifetime_earned, lifetime_spent)
    VALUES (p_tenant_id, 0, 0, 0)
    ON CONFLICT (tenant_id) DO NOTHING;

    v_current_balance := 0;
  END IF;

  -- For usage/debit types, validate sufficient balance
  IF p_transaction_type IN ('usage', 'transfer_out') THEN
    IF v_current_balance < p_amount THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient credits',
        'current_balance', v_current_balance,
        'required', p_amount,
        'shortfall', p_amount - v_current_balance
      );
    END IF;
    v_new_balance := v_current_balance - p_amount;
  ELSE
    -- For credit types (purchase, refund, bonus, adjustment, transfer_in)
    v_new_balance := v_current_balance + p_amount;
  END IF;

  -- Update the balance
  UPDATE public.tenant_credits
  SET
    balance = v_new_balance,
    lifetime_spent = CASE
      WHEN p_transaction_type IN ('usage', 'transfer_out') THEN COALESCE(lifetime_spent, 0) + p_amount
      ELSE COALESCE(lifetime_spent, 0)
    END,
    lifetime_earned = CASE
      WHEN p_transaction_type IN ('purchase', 'bonus', 'transfer_in') THEN COALESCE(lifetime_earned, 0) + p_amount
      ELSE COALESCE(lifetime_earned, 0)
    END,
    updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  -- Create transaction record
  INSERT INTO public.credit_transactions (
    tenant_id,
    amount,
    balance_after,
    transaction_type,
    action_type,
    reference_id,
    reference_type,
    description,
    metadata
  ) VALUES (
    p_tenant_id,
    CASE WHEN p_transaction_type IN ('usage', 'expiration', 'transfer_out') THEN -p_amount ELSE p_amount END,
    v_new_balance,
    p_transaction_type,
    p_transaction_type,
    COALESCE(p_reference_id, gen_random_uuid()::text),
    p_reference_type,
    COALESCE(p_description, p_transaction_type || ' of ' || p_amount || ' credits'),
    jsonb_build_object(
      'user_id', p_user_id,
      'balance_before', v_current_balance,
      'balance_after', v_new_balance
    )
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id,
    'amount', p_amount,
    'balance_before', v_current_balance
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.update_credit_balance TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_credit_balance TO service_role;

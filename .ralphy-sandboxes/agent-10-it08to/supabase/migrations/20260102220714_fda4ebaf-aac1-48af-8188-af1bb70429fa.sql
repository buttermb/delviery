-- Enhanced consume_credits with rate limiting and idempotency
CREATE OR REPLACE FUNCTION public.consume_credits(
  p_tenant_id UUID,
  p_amount INTEGER,
  p_action_key TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_action_cost INTEGER;
  v_category TEXT;
  v_credits_used_today INTEGER;
  v_daily_limit INTEGER := 10000; -- Max 10k credits/day to prevent abuse
  v_existing_tx UUID;
  v_final_reference_id TEXT;
BEGIN
  -- Generate reference_id if not provided (for tracking)
  v_final_reference_id := COALESCE(p_reference_id, gen_random_uuid()::text);

  -- IDEMPOTENCY CHECK: If reference_id provided, check if already processed
  IF p_reference_id IS NOT NULL THEN
    SELECT id INTO v_existing_tx
    FROM public.credit_transactions
    WHERE tenant_id = p_tenant_id
      AND action_type = p_action_key
      AND reference_id = p_reference_id
    LIMIT 1;
    
    IF v_existing_tx IS NOT NULL THEN
      -- Already processed, return success with current balance
      SELECT balance INTO v_current_balance
      FROM public.tenant_credits
      WHERE tenant_id = p_tenant_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'consumed', 0,
        'balance', COALESCE(v_current_balance, 0),
        'duplicate', true,
        'message', 'Transaction already processed'
      );
    END IF;
  END IF;

  -- Get action cost from credit_costs table
  SELECT credit_cost, category INTO v_action_cost, v_category
  FROM public.credit_costs
  WHERE action_key = p_action_key AND is_active = true;
  
  -- If no specific cost found, use provided amount
  IF v_action_cost IS NULL THEN
    v_action_cost := p_amount;
  END IF;
  
  -- Get current balance with row lock
  SELECT balance, COALESCE(credits_used_today, 0)
  INTO v_current_balance, v_credits_used_today
  FROM public.tenant_credits
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;
  
  -- Check if tenant has credit record
  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No credit balance found for tenant',
      'balance', 0
    );
  END IF;
  
  -- RATE LIMIT CHECK: Prevent abuse by checking daily usage
  IF v_credits_used_today >= v_daily_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily credit limit exceeded. Please try again tomorrow.',
      'balance', v_current_balance,
      'daily_used', v_credits_used_today,
      'daily_limit', v_daily_limit
    );
  END IF;
  
  -- Check if sufficient balance
  IF v_current_balance < v_action_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'balance', v_current_balance,
      'required', v_action_cost
    );
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_current_balance - v_action_cost;
  
  -- Update balance
  UPDATE public.tenant_credits
  SET 
    balance = v_new_balance,
    lifetime_spent = COALESCE(lifetime_spent, 0) + v_action_cost,
    credits_used_today = COALESCE(credits_used_today, 0) + v_action_cost,
    updated_at = NOW()
  WHERE tenant_id = p_tenant_id;
  
  -- Record transaction with idempotency protection
  INSERT INTO public.credit_transactions (
    tenant_id,
    amount,
    balance_after,
    transaction_type,
    description,
    action_type,
    reference_id,
    metadata
  ) VALUES (
    p_tenant_id,
    -v_action_cost,
    v_new_balance,
    'consumption',
    COALESCE(p_description, 'Credit consumption: ' || p_action_key),
    p_action_key,
    v_final_reference_id,
    jsonb_build_object(
      'action_key', p_action_key,
      'category', v_category,
      'cost', v_action_cost
    ) || COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT DO NOTHING;
  
  RETURN jsonb_build_object(
    'success', true,
    'consumed', v_action_cost,
    'balance', v_new_balance,
    'reference_id', v_final_reference_id
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.consume_credits TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits TO service_role;
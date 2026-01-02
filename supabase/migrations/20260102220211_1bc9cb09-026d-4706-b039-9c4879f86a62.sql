-- Update purchase_credits to be idempotent (return existing if duplicate)
CREATE OR REPLACE FUNCTION public.purchase_credits(
  p_tenant_id UUID,
  p_amount INTEGER,
  p_stripe_payment_id TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
  v_existing_balance INTEGER;
BEGIN
  -- IDEMPOTENCY CHECK: If stripe_payment_id provided, check if already processed
  IF p_stripe_payment_id IS NOT NULL THEN
    SELECT balance_after INTO v_existing_balance
    FROM credit_transactions
    WHERE reference_id = p_stripe_payment_id
      AND transaction_type = 'purchase'
    LIMIT 1;
    
    IF v_existing_balance IS NOT NULL THEN
      -- Already processed, return the balance from that transaction
      RAISE NOTICE 'Purchase already processed for payment_id: %', p_stripe_payment_id;
      RETURN v_existing_balance;
    END IF;
  END IF;

  -- Lock the row to prevent race conditions
  PERFORM 1 FROM tenant_credits WHERE tenant_id = p_tenant_id FOR UPDATE;

  -- Insert or update tenant_credits
  INSERT INTO tenant_credits (tenant_id, balance, updated_at)
  VALUES (p_tenant_id, p_amount, now())
  ON CONFLICT (tenant_id) 
  DO UPDATE SET 
    balance = tenant_credits.balance + p_amount,
    updated_at = now();

  -- Get new balance
  SELECT balance INTO v_new_balance
  FROM tenant_credits
  WHERE tenant_id = p_tenant_id;

  -- Record transaction with idempotency key
  INSERT INTO credit_transactions (
    tenant_id,
    transaction_type,
    amount,
    balance_after,
    description,
    reference_type,
    reference_id,
    created_at
  ) VALUES (
    p_tenant_id,
    'purchase',
    p_amount,
    v_new_balance,
    'Credit package purchase',
    'stripe_payment',
    COALESCE(p_stripe_payment_id, gen_random_uuid()::text),
    now()
  )
  ON CONFLICT DO NOTHING;

  RETURN v_new_balance;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.purchase_credits TO service_role;
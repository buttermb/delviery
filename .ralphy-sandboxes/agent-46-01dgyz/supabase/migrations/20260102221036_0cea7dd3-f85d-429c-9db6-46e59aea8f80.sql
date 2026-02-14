-- Enhanced grant_free_credits with idempotency and abuse prevention
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
  v_last_grant_at TIMESTAMPTZ;
  v_grant_month TEXT;
  v_current_month TEXT;
  v_existing_grant UUID;
  v_max_monthly_grant INTEGER := 500; -- Cap free grants at 500/month
BEGIN
  -- Get current month for idempotency key
  v_current_month := to_char(NOW(), 'YYYY-MM');
  v_grant_month := 'free_grant:' || p_tenant_id::text || ':' || v_current_month;
  
  -- IDEMPOTENCY CHECK: Check if already granted this month via transaction
  SELECT id INTO v_existing_grant
  FROM public.credit_transactions
  WHERE tenant_id = p_tenant_id
    AND transaction_type = 'free_grant'
    AND reference_id = v_grant_month
  LIMIT 1;
  
  IF v_existing_grant IS NOT NULL THEN
    -- Already granted this month
    SELECT balance INTO v_new_balance
    FROM public.tenant_credits
    WHERE tenant_id = p_tenant_id;
    
    RETURN QUERY SELECT false, COALESCE(v_new_balance, 0), 'Free credits already granted this month'::TEXT;
    RETURN;
  END IF;
  
  -- ABUSE PREVENTION: Check last_free_grant_at to prevent rapid grants
  SELECT last_free_grant_at INTO v_last_grant_at
  FROM public.tenant_credits
  WHERE tenant_id = p_tenant_id;
  
  IF v_last_grant_at IS NOT NULL AND 
     v_last_grant_at > NOW() - INTERVAL '25 days' THEN
    -- Too soon for another grant (allows slight early renewal but prevents abuse)
    SELECT balance INTO v_new_balance
    FROM public.tenant_credits
    WHERE tenant_id = p_tenant_id;
    
    RETURN QUERY SELECT false, COALESCE(v_new_balance, 0), 'Too soon for another free credit grant'::TEXT;
    RETURN;
  END IF;
  
  -- CAP CHECK: Limit grant amount
  IF p_amount > v_max_monthly_grant THEN
    RETURN QUERY SELECT false, 0, 'Grant amount exceeds maximum allowed'::TEXT;
    RETURN;
  END IF;

  -- Get or create credit record with row lock
  INSERT INTO public.tenant_credits (tenant_id, balance, lifetime_earned, last_free_grant_at)
  VALUES (p_tenant_id, p_amount, p_amount, NOW())
  ON CONFLICT (tenant_id) DO UPDATE SET
    balance = tenant_credits.balance + p_amount,
    lifetime_earned = COALESCE(tenant_credits.lifetime_earned, 0) + p_amount,
    last_free_grant_at = NOW(),
    updated_at = NOW()
  RETURNING balance INTO v_new_balance;
  
  -- Record transaction with idempotency key
  INSERT INTO public.credit_transactions (
    tenant_id,
    amount,
    balance_after,
    transaction_type,
    action_type,
    reference_id,
    description,
    metadata
  ) VALUES (
    p_tenant_id,
    p_amount,
    v_new_balance,
    'free_grant',
    'monthly_refresh',
    v_grant_month,
    'Monthly free credit grant',
    jsonb_build_object('grant_month', v_current_month, 'granted_at', NOW())
  )
  ON CONFLICT DO NOTHING;
  
  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.grant_free_credits TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_free_credits TO service_role;
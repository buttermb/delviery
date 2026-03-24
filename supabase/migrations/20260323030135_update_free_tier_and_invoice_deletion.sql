-- Update grant_free_credits to use 10000 credits limit
DROP FUNCTION IF EXISTS public.grant_free_credits(uuid, integer);
CREATE OR REPLACE FUNCTION public.grant_free_credits(p_tenant_id uuid, p_amount integer DEFAULT 10000)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_new_balance INTEGER;
  v_max_monthly_grant INTEGER := 10000;
  v_credits_granted INTEGER;
  v_transaction_id UUID;
BEGIN
  -- 1. Validate permissions (must be run by service role or authenticated admin)
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Only service_role can execute this function directly';
  END IF;

  -- 2. Validate parameters
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Grant amount must be greater than 0';
  END IF;

  -- 3. Cap the grant amount (safety check)
  v_credits_granted := LEAST(p_amount, v_max_monthly_grant);

  -- 4. Update the balance
  UPDATE credit_balances
  SET 
    balance = balance + v_credits_granted,
    last_updated_at = NOW()
  WHERE tenant_id = p_tenant_id
  RETURNING balance INTO v_new_balance;

  -- If it wasn't found, insert it
  IF v_new_balance IS NULL THEN
    INSERT INTO credit_balances (tenant_id, balance, free_tier)
    VALUES (p_tenant_id, v_credits_granted, true)
    RETURNING balance INTO v_new_balance;
  END IF;

  -- 5. Record the transaction
  INSERT INTO credit_transactions (
    tenant_id,
    amount,
    balance_after,
    tx_type,
    category,
    description,
    metadata
  ) VALUES (
    p_tenant_id,
    v_credits_granted,
    v_new_balance,
    'grant',
    'system_grant',
    'Monthly free tier credit grant',
    jsonb_build_object(
      'grant_type', 'monthly_free_tier',
      'requested_amount', p_amount,
      'actual_granted', v_credits_granted
    )
  ) RETURNING id INTO v_transaction_id;

  -- 6. Return success result
  RETURN jsonb_build_object(
    'success', true,
    'credits_granted', v_credits_granted,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error granting free credits: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;

-- Ensure secure invoice deletion restricted to draft status only
DROP POLICY IF EXISTS "Users can delete draft invoices in their tenant" ON public.customer_invoices;

CREATE POLICY "Users can delete draft invoices in their tenant" 
ON public.customer_invoices 
FOR DELETE 
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM public.tenant_users 
    WHERE user_id = auth.uid()
  ) 
  AND status = 'draft'
);

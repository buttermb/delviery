-- ============================================================================
-- Fix credit_transactions table schema and consume_credits function
-- ============================================================================

-- Step 1: Add missing columns to credit_transactions
ALTER TABLE public.credit_transactions 
ADD COLUMN IF NOT EXISTS action_type TEXT;

ALTER TABLE public.credit_transactions 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Step 2: Change reference_id from UUID to TEXT to handle non-UUID references
ALTER TABLE public.credit_transactions 
DROP COLUMN IF EXISTS reference_id;

ALTER TABLE public.credit_transactions 
ADD COLUMN reference_id TEXT;

-- Add index for action_type queries
CREATE INDEX IF NOT EXISTS idx_credit_transactions_action_type 
ON public.credit_transactions(action_type);

-- Step 3: Drop the existing consume_credits function with exact signature
DROP FUNCTION IF EXISTS public.consume_credits(uuid, text, text, text, text);

-- Create the corrected consume_credits function
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
BEGIN
  -- Get action cost from credit_costs table
  SELECT credit_cost, category INTO v_action_cost, v_category
  FROM public.credit_costs
  WHERE action_key = p_action_key AND is_active = true;
  
  -- If no specific cost found, use provided amount
  IF v_action_cost IS NULL THEN
    v_action_cost := p_amount;
  END IF;
  
  -- Get current balance with row lock
  SELECT balance INTO v_current_balance
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
  
  -- Record transaction
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
    p_reference_id,
    jsonb_build_object(
      'action_key', p_action_key,
      'category', v_category,
      'cost', v_action_cost
    ) || COALESCE(p_metadata, '{}'::jsonb)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'consumed', v_action_cost,
    'balance', v_new_balance,
    'action_key', p_action_key
  );
END;
$$;

-- Step 4: Sync is_free_tier - Update tenants table to match tenant_credits
UPDATE public.tenants t
SET is_free_tier = true
WHERE EXISTS (
  SELECT 1 FROM public.tenant_credits tc 
  WHERE tc.tenant_id = t.id 
  AND tc.is_free_tier = true
)
AND t.is_free_tier = false;

-- Also set is_free_tier = true for any tenant without an active subscription
UPDATE public.tenants
SET is_free_tier = true
WHERE subscription_status IN ('trial', 'inactive', 'cancelled')
  OR subscription_status IS NULL;

-- Step 5: Create helper function for checking credits
DROP FUNCTION IF EXISTS public.check_credits(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.check_credits(
  p_tenant_id UUID,
  p_action_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
  v_cost INTEGER;
BEGIN
  SELECT balance INTO v_balance
  FROM public.tenant_credits
  WHERE tenant_id = p_tenant_id;
  
  SELECT credit_cost INTO v_cost
  FROM public.credit_costs
  WHERE action_key = p_action_key AND is_active = true;
  
  IF v_cost IS NULL THEN
    v_cost := 1;
  END IF;
  
  RETURN jsonb_build_object(
    'has_credits', COALESCE(v_balance, 0) >= v_cost,
    'balance', COALESCE(v_balance, 0),
    'cost', v_cost,
    'action_key', p_action_key
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.consume_credits TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits TO service_role;
GRANT EXECUTE ON FUNCTION public.check_credits TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_credits TO service_role;
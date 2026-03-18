-- ============================================================================
-- Process Credit Purchase Function
-- ============================================================================
-- Creates a function to handle credit package purchases:
-- 1. Validates the package is active and within purchase limits
-- 2. Calculates total credits (base + bonus)
-- 3. Calls update_credit_balance to atomically update balance/transactions
-- 4. Updates package current_purchases counter
-- 5. Returns the transaction record
-- ============================================================================

-- Add missing columns to credit_packages for purchase tracking and bonus
ALTER TABLE public.credit_packages
ADD COLUMN IF NOT EXISTS bonus_credits INTEGER DEFAULT 0;

ALTER TABLE public.credit_packages
ADD COLUMN IF NOT EXISTS max_purchases_per_user INTEGER;

ALTER TABLE public.credit_packages
ADD COLUMN IF NOT EXISTS total_purchase_limit INTEGER;

ALTER TABLE public.credit_packages
ADD COLUMN IF NOT EXISTS current_purchases INTEGER DEFAULT 0;

-- Create the process_credit_purchase function
CREATE OR REPLACE FUNCTION public.process_credit_purchase(
  p_user_id UUID,
  p_tenant_id UUID,
  p_package_id UUID,
  p_payment_intent_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_package RECORD;
  v_total_credits INTEGER;
  v_new_balance INTEGER;
  v_user_purchase_count INTEGER;
  v_transaction_id UUID;
  v_balance_after INTEGER;
BEGIN
  -- Lock and fetch the package to prevent race conditions
  SELECT *
  INTO v_package
  FROM credit_packages
  WHERE id = p_package_id
  FOR UPDATE;

  -- Validate package exists
  IF v_package IS NULL THEN
    RAISE EXCEPTION 'Credit package not found: %', p_package_id;
  END IF;

  -- Validate package is active
  IF NOT v_package.is_active THEN
    RAISE EXCEPTION 'Credit package is not active: %', v_package.name;
  END IF;

  -- Validate total purchase limit (if set)
  IF v_package.total_purchase_limit IS NOT NULL
     AND v_package.current_purchases >= v_package.total_purchase_limit THEN
    RAISE EXCEPTION 'Credit package has reached its total purchase limit: %', v_package.name;
  END IF;

  -- Validate per-user purchase limit (if set)
  IF v_package.max_purchases_per_user IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_user_purchase_count
    FROM credit_transactions
    WHERE tenant_id = p_tenant_id
      AND transaction_type = 'purchase'
      AND metadata->>'package_id' = p_package_id::text;

    IF v_user_purchase_count >= v_package.max_purchases_per_user THEN
      RAISE EXCEPTION 'User has reached the maximum purchase limit for package: %', v_package.name;
    END IF;
  END IF;

  -- Calculate total credits (base credits + bonus)
  v_total_credits := v_package.credits + COALESCE(v_package.bonus_credits, 0);

  -- Call update_credit_balance to atomically update balance and create transaction
  v_new_balance := update_credit_balance(
    p_user_id := p_user_id,
    p_tenant_id := p_tenant_id,
    p_amount := v_total_credits,
    p_transaction_type := 'purchase',
    p_description := format('Purchased %s (%s credits + %s bonus)',
      v_package.name, v_package.credits, COALESCE(v_package.bonus_credits, 0)),
    p_reference_type := 'stripe_payment',
    p_reference_id := p_payment_intent_id
  );

  -- Update package current_purchases counter
  UPDATE credit_packages
  SET current_purchases = COALESCE(current_purchases, 0) + 1,
      updated_at = now()
  WHERE id = p_package_id;

  -- Get the transaction record that was just created by update_credit_balance
  SELECT id, balance_after
  INTO v_transaction_id, v_balance_after
  FROM credit_transactions
  WHERE tenant_id = p_tenant_id
    AND transaction_type = 'purchase'
    AND reference_id = p_payment_intent_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Update the transaction metadata with package details
  UPDATE credit_transactions
  SET metadata = jsonb_build_object(
    'package_id', p_package_id,
    'package_name', v_package.name,
    'package_slug', v_package.slug,
    'base_credits', v_package.credits,
    'bonus_credits', COALESCE(v_package.bonus_credits, 0),
    'total_credits', v_total_credits,
    'price_cents', v_package.price_cents,
    'payment_intent_id', p_payment_intent_id
  )
  WHERE id = v_transaction_id;

  -- Return the transaction record as JSONB
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'package_id', p_package_id,
    'package_name', v_package.name,
    'base_credits', v_package.credits,
    'bonus_credits', COALESCE(v_package.bonus_credits, 0),
    'total_credits', v_total_credits,
    'new_balance', v_new_balance,
    'payment_intent_id', p_payment_intent_id,
    'current_purchases', v_package.current_purchases + 1
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.process_credit_purchase(UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_credit_purchase(UUID, UUID, UUID, TEXT) TO service_role;

-- Add comments
COMMENT ON FUNCTION public.process_credit_purchase IS 'Process a credit package purchase: validates package, calculates credits with bonus, updates balance, tracks purchases';

-- Create index for efficient per-user purchase count lookups
CREATE INDEX IF NOT EXISTS idx_credit_transactions_package_lookup
  ON public.credit_transactions ((metadata->>'package_id'), tenant_id, transaction_type);

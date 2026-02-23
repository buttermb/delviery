-- ============================================
-- COMPREHENSIVE CREDIT SYSTEM FIX MIGRATION
-- ============================================

-- Step 1: Add missing columns to tenant_credits (including is_free_tier)
ALTER TABLE public.tenant_credits 
ADD COLUMN IF NOT EXISTS is_free_tier boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS warning_25_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS warning_10_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS warning_5_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS warning_0_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS free_credits_balance integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS purchased_credits_balance integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_credits_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS credits_used_today integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS rollover_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS alerts_sent jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS last_free_grant_at timestamptz,
ADD COLUMN IF NOT EXISTS next_free_grant_at timestamptz;

-- Step 2: Add missing columns to credit_analytics
ALTER TABLE public.credit_analytics 
ADD COLUMN IF NOT EXISTS credits_at_event integer,
ADD COLUMN IF NOT EXISTS action_attempted text;

-- Step 3: Rename action_type to action_key in credit_costs if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'credit_costs' 
    AND column_name = 'action_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'credit_costs' 
    AND column_name = 'action_key'
  ) THEN
    ALTER TABLE public.credit_costs RENAME COLUMN action_type TO action_key;
  END IF;
END $$;

-- Step 4: Populate credit_costs with all action types from code
INSERT INTO public.credit_costs (action_key, credit_cost, description, is_active)
VALUES
  ('order.create', 5, 'Create a new order', true),
  ('order.process', 3, 'Process an existing order', true),
  ('order.cancel', 2, 'Cancel an order', true),
  ('order.refund', 3, 'Process order refund', true),
  ('order.bulk_create', 10, 'Create multiple orders at once', true),
  ('menu.create', 10, 'Create a new disposable menu', true),
  ('menu.update', 5, 'Update menu details', true),
  ('menu.share', 3, 'Share menu with customer', true),
  ('menu.duplicate', 8, 'Duplicate an existing menu', true),
  ('menu.bulk_share', 15, 'Share menu with multiple customers', true),
  ('product.create', 5, 'Add a new product', true),
  ('product.update', 2, 'Update product details', true),
  ('product.import', 8, 'Bulk import products', true),
  ('product.export', 3, 'Export product catalog', true),
  ('customer.create', 3, 'Add a new customer', true),
  ('customer.import', 10, 'Bulk import customers', true),
  ('customer.export', 5, 'Export customer list', true),
  ('customer.message', 2, 'Send message to customer', true),
  ('inventory.update', 2, 'Update inventory levels', true),
  ('inventory.audit', 5, 'Run inventory audit', true),
  ('inventory.transfer', 3, 'Transfer inventory between locations', true),
  ('inventory.adjustment', 2, 'Adjust inventory count', true),
  ('report.sales', 10, 'Generate sales report', true),
  ('report.inventory', 8, 'Generate inventory report', true),
  ('report.customers', 8, 'Generate customer report', true),
  ('report.analytics', 15, 'Generate analytics dashboard', true),
  ('report.custom', 20, 'Generate custom report', true),
  ('report.export', 5, 'Export report to file', true),
  ('sms.send', 3, 'Send SMS notification', true),
  ('email.send', 2, 'Send email notification', true),
  ('notification.push', 2, 'Send push notification', true),
  ('broadcast.send', 15, 'Send broadcast message', true),
  ('delivery.assign', 3, 'Assign delivery to courier', true),
  ('delivery.track', 2, 'Track delivery status', true),
  ('delivery.route', 5, 'Optimize delivery route', true),
  ('delivery.batch', 10, 'Create batch delivery', true),
  ('pos.transaction', 3, 'Process POS transaction', true),
  ('pos.shift_open', 2, 'Open POS shift', true),
  ('pos.shift_close', 2, 'Close POS shift', true),
  ('pos.void', 2, 'Void POS transaction', true),
  ('integration.sync', 10, 'Sync with external system', true),
  ('integration.import', 15, 'Import from integration', true),
  ('integration.export', 10, 'Export to integration', true),
  ('api.request', 5, 'External API request', true),
  ('ai.product_description', 15, 'Generate product description', true),
  ('ai.menu_suggestion', 20, 'AI menu suggestions', true),
  ('ai.inventory_forecast', 25, 'AI inventory forecasting', true),
  ('ai.customer_insights', 30, 'AI customer insights', true),
  ('ai.chat', 10, 'AI chat interaction', true),
  ('compliance.report', 10, 'Generate compliance report', true),
  ('compliance.audit', 15, 'Run compliance audit', true),
  ('compliance.document', 5, 'Generate compliance document', true)
ON CONFLICT (action_key) DO UPDATE SET
  credit_cost = EXCLUDED.credit_cost,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Step 5: Create consume_credits function
CREATE OR REPLACE FUNCTION public.consume_credits(
  p_tenant_id uuid,
  p_action_key text,
  p_description text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_cost integer;
  v_current_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
BEGIN
  -- Check for free actions
  IF p_action_key IN ('login', 'logout', 'view', 'profile.update') THEN
    RETURN jsonb_build_object(
      'success', true,
      'free_action', true,
      'credits_consumed', 0,
      'message', 'Free action - no credits consumed'
    );
  END IF;
  
  -- Get credit cost for action
  SELECT credit_cost INTO v_credit_cost
  FROM public.credit_costs
  WHERE action_key = p_action_key AND is_active = true;
  
  IF v_credit_cost IS NULL THEN
    v_credit_cost := 1;
  END IF;
  
  -- Get current balance
  SELECT balance INTO v_current_balance
  FROM public.tenant_credits
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;
  
  IF v_current_balance IS NULL THEN
    INSERT INTO public.tenant_credits (tenant_id, balance, is_free_tier)
    VALUES (p_tenant_id, 0, true)
    ON CONFLICT (tenant_id) DO NOTHING;
    v_current_balance := 0;
  END IF;
  
  IF v_current_balance < v_credit_cost THEN
    INSERT INTO public.credit_analytics (tenant_id, event_type, credits_at_event, action_attempted, metadata)
    VALUES (
      p_tenant_id, 
      'insufficient_credits', 
      v_current_balance, 
      p_action_key,
      jsonb_build_object('required', v_credit_cost, 'available', v_current_balance)
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'required', v_credit_cost,
      'available', v_current_balance,
      'message', format('Insufficient credits. Required: %s, Available: %s', v_credit_cost, v_current_balance)
    );
  END IF;
  
  v_new_balance := v_current_balance - v_credit_cost;
  
  UPDATE public.tenant_credits
  SET 
    balance = v_new_balance,
    credits_used_today = COALESCE(credits_used_today, 0) + v_credit_cost,
    updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  INSERT INTO public.credit_transactions (
    tenant_id,
    transaction_type,
    amount,
    balance_after,
    description,
    reference_id,
    reference_type
  ) VALUES (
    p_tenant_id,
    'consumption',
    -v_credit_cost,
    v_new_balance,
    COALESCE(p_description, p_action_key),
    p_reference_id,
    p_reference_type
  ) RETURNING id INTO v_transaction_id;
  
  INSERT INTO public.credit_analytics (tenant_id, event_type, credits_at_event, action_attempted, metadata)
  VALUES (
    p_tenant_id, 
    'credits_consumed', 
    v_new_balance, 
    p_action_key,
    jsonb_build_object('amount', v_credit_cost, 'transaction_id', v_transaction_id)
  );
  
  -- Update warning flags
  IF v_new_balance <= 100 AND v_new_balance > 50 THEN
    UPDATE public.tenant_credits SET warning_25_sent = true WHERE tenant_id = p_tenant_id AND warning_25_sent = false;
  ELSIF v_new_balance <= 50 AND v_new_balance > 20 THEN
    UPDATE public.tenant_credits SET warning_10_sent = true WHERE tenant_id = p_tenant_id AND warning_10_sent = false;
  ELSIF v_new_balance <= 20 AND v_new_balance > 0 THEN
    UPDATE public.tenant_credits SET warning_5_sent = true WHERE tenant_id = p_tenant_id AND warning_5_sent = false;
  ELSIF v_new_balance = 0 THEN
    UPDATE public.tenant_credits SET warning_0_sent = true WHERE tenant_id = p_tenant_id AND warning_0_sent = false;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_consumed', v_credit_cost,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id,
    'action', p_action_key
  );
END;
$$;

-- Step 6: Create grant_free_credits function
CREATE OR REPLACE FUNCTION public.grant_free_credits(
  p_tenant_id uuid DEFAULT NULL,
  p_amount integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_granted_count integer := 0;
  v_new_balance integer;
  v_transaction_id uuid;
BEGIN
  IF p_tenant_id IS NOT NULL THEN
    -- Grant to specific tenant
    UPDATE public.tenant_credits
    SET 
      balance = COALESCE(balance, 0) + p_amount,
      free_credits_balance = p_amount,
      last_free_grant_at = now(),
      next_free_grant_at = now() + interval '1 month',
      warning_25_sent = false,
      warning_10_sent = false,
      warning_5_sent = false,
      warning_0_sent = false,
      credits_used_today = 0,
      updated_at = now()
    WHERE tenant_id = p_tenant_id
    RETURNING balance INTO v_new_balance;
    
    IF v_new_balance IS NULL THEN
      INSERT INTO public.tenant_credits (tenant_id, balance, is_free_tier, free_credits_balance, last_free_grant_at, next_free_grant_at)
      VALUES (p_tenant_id, p_amount, true, p_amount, now(), now() + interval '1 month')
      RETURNING balance INTO v_new_balance;
    END IF;
    
    INSERT INTO public.credit_transactions (
      tenant_id, transaction_type, amount, balance_after, description
    ) VALUES (
      p_tenant_id, 'free_grant', p_amount, v_new_balance, 'Monthly free credits grant'
    ) RETURNING id INTO v_transaction_id;
    
    INSERT INTO public.credit_analytics (tenant_id, event_type, credits_at_event, metadata)
    VALUES (p_tenant_id, 'free_credits_granted', v_new_balance, jsonb_build_object('amount', p_amount));
    
    RETURN jsonb_build_object(
      'success', true,
      'granted_to', 1,
      'amount', p_amount,
      'new_balance', v_new_balance,
      'transaction_id', v_transaction_id
    );
  END IF;
  
  -- Grant to all eligible free tier tenants
  FOR v_tenant IN
    SELECT tc.tenant_id, tc.balance
    FROM public.tenant_credits tc
    WHERE tc.is_free_tier = true
    AND (tc.next_free_grant_at IS NULL OR tc.next_free_grant_at <= now())
  LOOP
    UPDATE public.tenant_credits
    SET 
      balance = COALESCE(balance, 0) + p_amount,
      free_credits_balance = p_amount,
      last_free_grant_at = now(),
      next_free_grant_at = now() + interval '1 month',
      warning_25_sent = false,
      warning_10_sent = false,
      warning_5_sent = false,
      warning_0_sent = false,
      credits_used_today = 0,
      updated_at = now()
    WHERE tenant_id = v_tenant.tenant_id
    RETURNING balance INTO v_new_balance;
    
    INSERT INTO public.credit_transactions (
      tenant_id, transaction_type, amount, balance_after, description
    ) VALUES (
      v_tenant.tenant_id, 'free_grant', p_amount, v_new_balance, 'Monthly free credits grant'
    );
    
    INSERT INTO public.credit_analytics (tenant_id, event_type, credits_at_event, metadata)
    VALUES (v_tenant.tenant_id, 'free_credits_granted', v_new_balance, jsonb_build_object('amount', p_amount));
    
    v_granted_count := v_granted_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'granted_to', v_granted_count,
    'amount_per_tenant', p_amount,
    'total_credits_granted', v_granted_count * p_amount
  );
END;
$$;

-- Step 7: Create check_credits helper function
CREATE OR REPLACE FUNCTION public.check_credits(
  p_tenant_id uuid,
  p_action_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_cost integer;
  v_current_balance integer;
BEGIN
  IF p_action_key IN ('login', 'logout', 'view', 'profile.update') THEN
    RETURN jsonb_build_object(
      'can_proceed', true,
      'free_action', true,
      'credits_required', 0
    );
  END IF;
  
  SELECT credit_cost INTO v_credit_cost
  FROM public.credit_costs
  WHERE action_key = p_action_key AND is_active = true;
  
  IF v_credit_cost IS NULL THEN
    v_credit_cost := 1;
  END IF;
  
  SELECT balance INTO v_current_balance
  FROM public.tenant_credits
  WHERE tenant_id = p_tenant_id;
  
  IF v_current_balance IS NULL THEN
    v_current_balance := 0;
  END IF;
  
  RETURN jsonb_build_object(
    'can_proceed', v_current_balance >= v_credit_cost,
    'credits_required', v_credit_cost,
    'credits_available', v_current_balance,
    'shortfall', GREATEST(0, v_credit_cost - v_current_balance)
  );
END;
$$;

-- Step 8: Grant initial credits to existing tenants
UPDATE public.tenant_credits
SET 
  balance = GREATEST(COALESCE(balance, 0), 500),
  free_credits_balance = 500,
  is_free_tier = true,
  last_free_grant_at = now(),
  next_free_grant_at = now() + interval '1 month'
WHERE COALESCE(balance, 0) = 0;

-- Ensure all tenants have tenant_credits records
INSERT INTO public.tenant_credits (tenant_id, balance, is_free_tier, free_credits_balance, last_free_grant_at, next_free_grant_at)
SELECT 
  t.id,
  500,
  true,
  500,
  now(),
  now() + interval '1 month'
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_credits tc WHERE tc.tenant_id = t.id
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Step 9: Create indexes for efficiency
CREATE INDEX IF NOT EXISTS idx_credit_costs_action_key ON public.credit_costs(action_key) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tenant_credits_free_tier ON public.tenant_credits(is_free_tier, next_free_grant_at);
CREATE INDEX IF NOT EXISTS idx_credit_analytics_tenant_event ON public.credit_analytics(tenant_id, event_type, created_at);

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.consume_credits TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_free_credits TO service_role;
GRANT EXECUTE ON FUNCTION public.check_credits TO authenticated;
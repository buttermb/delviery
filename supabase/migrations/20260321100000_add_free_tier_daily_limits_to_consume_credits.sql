-- ============================================================================
-- ADD FREE TIER DAILY LIMIT ENFORCEMENT TO consume_credits RPC
-- ============================================================================
-- Before this migration, consume_credits only checked:
-- 1. Overall daily credit limit (10k/day abuse prevention)
-- 2. Sufficient balance
--
-- After this migration, consume_credits also checks:
-- 1. If tenant is on free tier (tier_status = 'free')
-- 2. Maps action_key to free tier usage category
-- 3. Checks tenant_free_tier_usage for daily/monthly limits
-- 4. Increments the usage counter on success
-- ============================================================================

-- Drop existing function to replace
DROP FUNCTION IF EXISTS public.consume_credits(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB);

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
  v_tier_status TEXT;
  v_free_tier_action TEXT;
  v_free_tier_current INTEGER;
  v_free_tier_limit INTEGER;
  v_has_purchased BOOLEAN;
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

  -- Get current balance and tier status with row lock
  SELECT balance, COALESCE(credits_used_today, 0), COALESCE(tier_status, 'free')
  INTO v_current_balance, v_credits_used_today, v_tier_status
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

  -- ========================================================================
  -- FREE TIER DAILY LIMIT ENFORCEMENT
  -- ========================================================================
  -- Only applies to free tier tenants who have NOT purchased credits
  IF v_tier_status = 'free' THEN
    -- Check if tenant has purchased credits (bypass limits if yes + balance > 0)
    SELECT EXISTS(
      SELECT 1 FROM public.credit_transactions
      WHERE tenant_id = p_tenant_id
        AND transaction_type = 'purchase'
      LIMIT 1
    ) INTO v_has_purchased;

    -- Only enforce limits if no active purchased credits
    IF NOT v_has_purchased OR v_current_balance <= 0 THEN
      -- Map action_key to free tier usage category
      v_free_tier_action := CASE
        WHEN p_action_key IN ('menu_create', 'menu_generate') THEN 'menu_create'
        WHEN p_action_key IN ('order_create_manual', 'menu_order_received', 'order_create') THEN 'order_create'
        WHEN p_action_key IN ('send_sms', 'send_otp', 'send_verification_sms', 'send_klaviyo_sms') THEN 'sms_send'
        WHEN p_action_key IN ('send_email', 'send_welcome_email', 'send_invitation_email', 'send_verification_email', 'send_klaviyo_email', 'send_trial_reminder') THEN 'email_send'
        WHEN p_action_key IN ('pos_process_sale', 'pos_checkout') THEN 'pos_sale'
        WHEN p_action_key IN ('product_bulk_import', 'stock_bulk_update', 'customer_import', 'marketplace_bulk_update') THEN 'bulk_operation'
        WHEN p_action_key IN ('invoice_create', 'invoice_send') THEN 'invoice_create'
        WHEN p_action_key IN ('report_custom_generate', 'report_advanced_generate') THEN 'custom_report'
        WHEN p_action_key IN ('ai_suggestions', 'ai_insight_generate', 'ai_task_run', 'forecast_run', 'menu_ocr') THEN 'ai_feature'
        ELSE NULL
      END;

      -- If this action has a free tier limit, check it
      IF v_free_tier_action IS NOT NULL THEN
        -- Ensure usage record exists and reset if needed
        INSERT INTO public.tenant_free_tier_usage (tenant_id)
        VALUES (p_tenant_id)
        ON CONFLICT (tenant_id) DO NOTHING;

        -- Reset daily counters if last reset was before today
        UPDATE public.tenant_free_tier_usage
        SET
          menus_created_today = 0,
          orders_created_today = 0,
          sms_sent_today = 0,
          emails_sent_today = 0,
          pos_sales_today = 0,
          bulk_operations_today = 0,
          last_daily_reset = now()
        WHERE tenant_id = p_tenant_id
          AND last_daily_reset < date_trunc('day', now());

        -- Get current count and limit for the action
        SELECT
          CASE v_free_tier_action
            WHEN 'menu_create' THEN menus_created_today
            WHEN 'order_create' THEN orders_created_today
            WHEN 'sms_send' THEN sms_sent_today
            WHEN 'email_send' THEN emails_sent_today
            WHEN 'pos_sale' THEN pos_sales_today
            WHEN 'bulk_operation' THEN bulk_operations_today
            WHEN 'invoice_create' THEN invoices_this_month
            WHEN 'custom_report' THEN custom_reports_this_month
            WHEN 'ai_feature' THEN ai_features_this_month
            ELSE 0
          END
        INTO v_free_tier_current
        FROM public.tenant_free_tier_usage
        WHERE tenant_id = p_tenant_id;

        -- Look up the limit for this action type
        v_free_tier_limit := CASE v_free_tier_action
          WHEN 'menu_create' THEN 1       -- max_menus_per_day
          WHEN 'order_create' THEN 3      -- max_orders_per_day
          WHEN 'sms_send' THEN 2          -- max_sms_per_day
          WHEN 'email_send' THEN 5        -- max_emails_per_day
          WHEN 'pos_sale' THEN 5          -- max_pos_sales_per_day
          WHEN 'bulk_operation' THEN 1    -- max_bulk_operations_per_day
          WHEN 'invoice_create' THEN 3    -- max_invoices_per_month
          WHEN 'custom_report' THEN 0     -- blocked on free tier
          WHEN 'ai_feature' THEN 0        -- blocked on free tier
          ELSE 999999
        END;

        -- Check if limit exceeded
        IF COALESCE(v_free_tier_current, 0) >= v_free_tier_limit THEN
          -- Determine period for error message
          RETURN jsonb_build_object(
            'success', false,
            'error', 'Daily limit reached for free tier',
            'balance', v_current_balance,
            'free_tier_limit', jsonb_build_object(
              'action_type', v_free_tier_action,
              'current_count', COALESCE(v_free_tier_current, 0),
              'limit', v_free_tier_limit,
              'period', CASE
                WHEN v_free_tier_action IN ('invoice_create', 'custom_report', 'ai_feature') THEN 'month'
                ELSE 'day'
              END,
              'message', CASE
                WHEN v_free_tier_limit = 0 THEN 'This feature requires a paid plan'
                WHEN v_free_tier_action IN ('invoice_create', 'custom_report', 'ai_feature') THEN
                  'Monthly limit of ' || v_free_tier_limit || ' reached. Upgrade for unlimited access.'
                ELSE
                  'Daily limit of ' || v_free_tier_limit || ' reached. Try again tomorrow or upgrade.'
              END
            )
          );
        END IF;
      END IF;
    END IF;
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

  -- Increment free tier usage counter if applicable
  IF v_tier_status = 'free' AND v_free_tier_action IS NOT NULL THEN
    CASE v_free_tier_action
      WHEN 'menu_create' THEN
        UPDATE public.tenant_free_tier_usage SET menus_created_today = menus_created_today + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
      WHEN 'order_create' THEN
        UPDATE public.tenant_free_tier_usage SET orders_created_today = orders_created_today + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
      WHEN 'sms_send' THEN
        UPDATE public.tenant_free_tier_usage SET sms_sent_today = sms_sent_today + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
      WHEN 'email_send' THEN
        UPDATE public.tenant_free_tier_usage SET emails_sent_today = emails_sent_today + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
      WHEN 'pos_sale' THEN
        UPDATE public.tenant_free_tier_usage SET pos_sales_today = pos_sales_today + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
      WHEN 'bulk_operation' THEN
        UPDATE public.tenant_free_tier_usage SET bulk_operations_today = bulk_operations_today + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
      WHEN 'invoice_create' THEN
        UPDATE public.tenant_free_tier_usage SET invoices_this_month = invoices_this_month + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
      WHEN 'custom_report' THEN
        UPDATE public.tenant_free_tier_usage SET custom_reports_this_month = custom_reports_this_month + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
      WHEN 'ai_feature' THEN
        UPDATE public.tenant_free_tier_usage SET ai_features_this_month = ai_features_this_month + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
      ELSE
        NULL;
    END CASE;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'consumed', v_action_cost,
    'balance', v_new_balance,
    'reference_id', v_final_reference_id
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.consume_credits(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB) TO service_role;

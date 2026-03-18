-- ============================================================================
-- CREDIT SYSTEM V3 - Enhanced Tracking and Aggressive Monetization
-- ============================================================================
-- Changes:
-- 1. Reduce default credits from 10,000 to 500 (~1 day active use)
-- 2. Add daily/weekly/monthly usage tracking columns
-- 3. Add upgrade trigger tracking
-- 4. Add tier status field
-- 5. Create credit_grants table for promotional credits
-- 6. Update consume_credits function to track usage
-- 7. Create reset functions for scheduled jobs
-- ============================================================================

-- ============================================================================
-- ENHANCED TENANT_CREDITS TABLE
-- ============================================================================

-- Add usage tracking columns
ALTER TABLE public.tenant_credits
ADD COLUMN IF NOT EXISTS credits_used_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_used_this_week INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_used_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS upgrade_triggers_shown JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS tier_status TEXT DEFAULT 'free' CHECK (tier_status IN ('free', 'paid')),
ADD COLUMN IF NOT EXISTS last_daily_reset TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS last_weekly_reset TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS last_monthly_reset TIMESTAMPTZ DEFAULT now();

-- Update default balance from 10000 to 500 for new records
ALTER TABLE public.tenant_credits 
ALTER COLUMN balance SET DEFAULT 500;

-- Update lifetime_earned default
ALTER TABLE public.tenant_credits 
ALTER COLUMN lifetime_earned SET DEFAULT 500;

COMMENT ON COLUMN public.tenant_credits.credits_used_today IS 'Credits consumed today, resets at midnight';
COMMENT ON COLUMN public.tenant_credits.credits_used_this_week IS 'Credits consumed this week, resets Sunday midnight';
COMMENT ON COLUMN public.tenant_credits.credits_used_this_month IS 'Credits consumed this month, resets on billing cycle';
COMMENT ON COLUMN public.tenant_credits.upgrade_triggers_shown IS 'Tracks which upgrade modals have been shown to prevent spam';
COMMENT ON COLUMN public.tenant_credits.tier_status IS 'Current tier status: free or paid';

-- ============================================================================
-- CREDIT GRANTS TABLE
-- ============================================================================
-- For promotional/bonus credits with optional expiration

CREATE TABLE IF NOT EXISTS public.credit_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  grant_type TEXT NOT NULL CHECK (grant_type IN ('signup_bonus', 'referral', 'promo_code', 'support', 'admin_grant', 'loyalty', 'compensation')),
  promo_code TEXT,
  expires_at TIMESTAMPTZ,
  granted_at TIMESTAMPTZ DEFAULT now(),
  granted_by UUID, -- admin user ID if manual grant
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_grants_tenant_id ON public.credit_grants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_grants_expires_at ON public.credit_grants(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_grants_grant_type ON public.credit_grants(grant_type);
CREATE INDEX IF NOT EXISTS idx_credit_grants_is_used ON public.credit_grants(is_used) WHERE is_used = false;

-- Enable RLS
ALTER TABLE public.credit_grants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_grants
CREATE POLICY "Tenants can view own credit grants" ON public.credit_grants
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.profiles WHERE tenant_id = credit_grants.tenant_id
    )
  );

CREATE POLICY "Service role full access to credit_grants" ON public.credit_grants
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

COMMENT ON TABLE public.credit_grants IS 'Promotional and bonus credit grants with optional expiration';

-- ============================================================================
-- UPDATED CONSUME_CREDITS FUNCTION
-- ============================================================================
-- Now tracks daily/weekly/monthly usage

CREATE OR REPLACE FUNCTION public.consume_credits(
  p_tenant_id UUID,
  p_action_key TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance INTEGER,
  credits_cost INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost INTEGER;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_is_free_tier BOOLEAN;
  v_tier_status TEXT;
BEGIN
  -- Get the credit cost for this action
  SELECT credits INTO v_cost
  FROM public.credit_costs
  WHERE action_key = p_action_key AND is_active = true;
  
  -- If cost not found in DB, check for zero cost (free action)
  IF v_cost IS NULL THEN
    v_cost := 0; -- Default to free if not found
  END IF;
  
  -- If action is free, allow without checking balance
  IF v_cost = 0 THEN
    RETURN QUERY SELECT true, -1, 0, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Check if tenant is on free tier
  SELECT is_free_tier INTO v_is_free_tier
  FROM public.tenants
  WHERE id = p_tenant_id;
  
  -- If not free tier, skip credit deduction
  IF v_is_free_tier IS NOT TRUE THEN
    RETURN QUERY SELECT true, -1, v_cost, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Get current balance with lock
  SELECT balance, tier_status INTO v_current_balance, v_tier_status
  FROM public.tenant_credits
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;
  
  -- If paid tier status, skip deduction
  IF v_tier_status = 'paid' THEN
    RETURN QUERY SELECT true, -1, v_cost, NULL::TEXT;
    RETURN;
  END IF;
  
  -- If no credit record exists, create one with 500 credits (new default)
  IF v_current_balance IS NULL THEN
    INSERT INTO public.tenant_credits (tenant_id, balance, lifetime_earned)
    VALUES (p_tenant_id, 500, 500)
    ON CONFLICT (tenant_id) DO NOTHING;
    v_current_balance := 500;
  END IF;
  
  -- Check if enough credits
  IF v_current_balance < v_cost THEN
    RETURN QUERY SELECT false, v_current_balance, v_cost, 'Insufficient credits. Need ' || v_cost || ', have ' || v_current_balance;
    RETURN;
  END IF;
  
  -- Deduct credits and update usage tracking
  v_new_balance := v_current_balance - v_cost;
  
  UPDATE public.tenant_credits
  SET 
    balance = v_new_balance,
    lifetime_spent = lifetime_spent + v_cost,
    credits_used_today = credits_used_today + v_cost,
    credits_used_this_week = credits_used_this_week + v_cost,
    credits_used_this_month = credits_used_this_month + v_cost,
    updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  -- Record transaction
  INSERT INTO public.credit_transactions (
    tenant_id,
    amount,
    balance_after,
    transaction_type,
    action_type,
    reference_id,
    reference_type,
    description
  ) VALUES (
    p_tenant_id,
    -v_cost,
    v_new_balance,
    'usage',
    p_action_key,
    p_reference_id,
    p_reference_type,
    COALESCE(p_description, 'Credit usage: ' || p_action_key)
  );
  
  RETURN QUERY SELECT true, v_new_balance, v_cost, NULL::TEXT;
END;
$$;

-- ============================================================================
-- RESET FUNCTIONS FOR SCHEDULED JOBS
-- ============================================================================

-- Reset daily credits (runs at midnight)
CREATE OR REPLACE FUNCTION public.reset_daily_credits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.tenant_credits
  SET 
    credits_used_today = 0,
    last_daily_reset = now(),
    updated_at = now()
  WHERE credits_used_today > 0;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Reset weekly credits (runs Sunday midnight)
CREATE OR REPLACE FUNCTION public.reset_weekly_credits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.tenant_credits
  SET 
    credits_used_this_week = 0,
    last_weekly_reset = now(),
    updated_at = now()
  WHERE credits_used_this_week > 0;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Reset monthly credits (called on billing cycle)
CREATE OR REPLACE FUNCTION public.reset_monthly_credits(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tenant_credits
  SET 
    credits_used_this_month = 0,
    last_monthly_reset = now(),
    updated_at = now()
  WHERE tenant_id = p_tenant_id;
END;
$$;

-- ============================================================================
-- ADMIN CREDIT ADJUSTMENT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_adjust_credits(
  p_tenant_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL,
  p_admin_user_id UUID DEFAULT NULL
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
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Get current balance
  SELECT balance INTO v_current_balance
  FROM public.tenant_credits
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;
  
  -- If no credit record exists, create one
  IF v_current_balance IS NULL THEN
    INSERT INTO public.tenant_credits (tenant_id, balance, lifetime_earned)
    VALUES (p_tenant_id, 500, 500)
    ON CONFLICT (tenant_id) DO NOTHING
    RETURNING balance INTO v_current_balance;
    
    IF v_current_balance IS NULL THEN
      SELECT balance INTO v_current_balance
      FROM public.tenant_credits
      WHERE tenant_id = p_tenant_id;
    END IF;
  END IF;
  
  -- Calculate new balance (allow negative for adjustments but cap at 0)
  v_new_balance := GREATEST(0, v_current_balance + p_amount);
  
  -- Update balance
  UPDATE public.tenant_credits
  SET 
    balance = v_new_balance,
    lifetime_earned = CASE WHEN p_amount > 0 THEN lifetime_earned + p_amount ELSE lifetime_earned END,
    lifetime_spent = CASE WHEN p_amount < 0 THEN lifetime_spent + ABS(p_amount) ELSE lifetime_spent END,
    updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  -- Record transaction
  INSERT INTO public.credit_transactions (
    tenant_id,
    amount,
    balance_after,
    transaction_type,
    description,
    metadata
  ) VALUES (
    p_tenant_id,
    p_amount,
    v_new_balance,
    'adjustment',
    p_reason || COALESCE(': ' || p_notes, ''),
    jsonb_build_object(
      'admin_user_id', p_admin_user_id,
      'reason', p_reason,
      'notes', p_notes,
      'previous_balance', v_current_balance
    )
  );
  
  -- Record in credit_grants if positive adjustment
  IF p_amount > 0 THEN
    INSERT INTO public.credit_grants (
      tenant_id,
      amount,
      grant_type,
      granted_by,
      notes
    ) VALUES (
      p_tenant_id,
      p_amount,
      'admin_grant',
      p_admin_user_id,
      p_reason || COALESCE(': ' || p_notes, '')
    );
  END IF;
  
  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

-- ============================================================================
-- PLATFORM CREDIT STATS FUNCTION (for super admin)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_platform_credit_stats()
RETURNS TABLE (
  total_free_tier_tenants BIGINT,
  total_paid_tier_tenants BIGINT,
  tenants_at_zero BIGINT,
  tenants_critical BIGINT,
  tenants_warning BIGINT,
  tenants_healthy BIGINT,
  total_credits_consumed_today BIGINT,
  total_credits_consumed_week BIGINT,
  total_credits_consumed_month BIGINT,
  avg_balance_free_tier NUMERIC,
  total_credit_purchases_revenue BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.tenants WHERE is_free_tier = true)::BIGINT,
    (SELECT COUNT(*) FROM public.tenants WHERE is_free_tier = false OR is_free_tier IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM public.tenant_credits tc 
     JOIN public.tenants t ON t.id = tc.tenant_id 
     WHERE t.is_free_tier = true AND tc.balance = 0)::BIGINT,
    (SELECT COUNT(*) FROM public.tenant_credits tc 
     JOIN public.tenants t ON t.id = tc.tenant_id 
     WHERE t.is_free_tier = true AND tc.balance > 0 AND tc.balance <= 50)::BIGINT,
    (SELECT COUNT(*) FROM public.tenant_credits tc 
     JOIN public.tenants t ON t.id = tc.tenant_id 
     WHERE t.is_free_tier = true AND tc.balance > 50 AND tc.balance <= 200)::BIGINT,
    (SELECT COUNT(*) FROM public.tenant_credits tc 
     JOIN public.tenants t ON t.id = tc.tenant_id 
     WHERE t.is_free_tier = true AND tc.balance > 200)::BIGINT,
    (SELECT COALESCE(SUM(credits_used_today), 0) FROM public.tenant_credits)::BIGINT,
    (SELECT COALESCE(SUM(credits_used_this_week), 0) FROM public.tenant_credits)::BIGINT,
    (SELECT COALESCE(SUM(credits_used_this_month), 0) FROM public.tenant_credits)::BIGINT,
    (SELECT COALESCE(AVG(tc.balance), 0) FROM public.tenant_credits tc 
     JOIN public.tenants t ON t.id = tc.tenant_id 
     WHERE t.is_free_tier = true)::NUMERIC,
    (SELECT COALESCE(SUM(amount), 0) FROM public.credit_transactions 
     WHERE transaction_type = 'purchase' AND created_at >= date_trunc('month', now()))::BIGINT;
END;
$$;

-- ============================================================================
-- GET TENANTS WITH CREDITS (for super admin list)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_tenants_with_credits(
  p_status TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  tenant_slug TEXT,
  balance INTEGER,
  tier_status TEXT,
  is_free_tier BOOLEAN,
  credits_used_today INTEGER,
  credits_used_this_week INTEGER,
  credits_used_this_month INTEGER,
  lifetime_spent INTEGER,
  last_activity TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  credit_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.business_name,
    t.slug,
    COALESCE(tc.balance, 500),
    COALESCE(tc.tier_status, 'free'),
    COALESCE(t.is_free_tier, false),
    COALESCE(tc.credits_used_today, 0),
    COALESCE(tc.credits_used_this_week, 0),
    COALESCE(tc.credits_used_this_month, 0),
    COALESCE(tc.lifetime_spent, 0),
    tc.updated_at,
    t.created_at,
    CASE
      WHEN t.is_free_tier IS NOT TRUE THEN 'unlimited'
      WHEN COALESCE(tc.balance, 500) = 0 THEN 'depleted'
      WHEN COALESCE(tc.balance, 500) <= 15 THEN 'critical'
      WHEN COALESCE(tc.balance, 500) <= 50 THEN 'warning'
      ELSE 'healthy'
    END
  FROM public.tenants t
  LEFT JOIN public.tenant_credits tc ON tc.tenant_id = t.id
  WHERE
    (p_search IS NULL OR 
     t.business_name ILIKE '%' || p_search || '%' OR 
     t.slug ILIKE '%' || p_search || '%')
    AND
    (p_status IS NULL OR
     (p_status = 'unlimited' AND t.is_free_tier IS NOT TRUE) OR
     (p_status = 'depleted' AND t.is_free_tier = true AND COALESCE(tc.balance, 500) = 0) OR
     (p_status = 'critical' AND t.is_free_tier = true AND COALESCE(tc.balance, 500) > 0 AND COALESCE(tc.balance, 500) <= 15) OR
     (p_status = 'warning' AND t.is_free_tier = true AND COALESCE(tc.balance, 500) > 15 AND COALESCE(tc.balance, 500) <= 50) OR
     (p_status = 'healthy' AND t.is_free_tier = true AND COALESCE(tc.balance, 500) > 50))
  ORDER BY tc.updated_at DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================================================
-- GRANT BULK CREDITS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.grant_bulk_credits(
  p_tenant_ids UUID[],
  p_amount INTEGER,
  p_grant_type TEXT,
  p_notes TEXT DEFAULT NULL,
  p_admin_user_id UUID DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOREACH v_tenant_id IN ARRAY p_tenant_ids
  LOOP
    -- Update or insert credit record
    INSERT INTO public.tenant_credits (tenant_id, balance, lifetime_earned)
    VALUES (v_tenant_id, p_amount, p_amount)
    ON CONFLICT (tenant_id) DO UPDATE SET
      balance = tenant_credits.balance + p_amount,
      lifetime_earned = tenant_credits.lifetime_earned + p_amount,
      updated_at = now();
    
    -- Record transaction
    INSERT INTO public.credit_transactions (
      tenant_id,
      amount,
      balance_after,
      transaction_type,
      description,
      metadata
    ) VALUES (
      v_tenant_id,
      p_amount,
      (SELECT balance FROM public.tenant_credits WHERE tenant_id = v_tenant_id),
      'bonus',
      'Bulk grant: ' || p_grant_type || COALESCE(' - ' || p_notes, ''),
      jsonb_build_object('admin_user_id', p_admin_user_id, 'grant_type', p_grant_type)
    );
    
    -- Record grant
    INSERT INTO public.credit_grants (
      tenant_id,
      amount,
      grant_type,
      granted_by,
      expires_at,
      notes
    ) VALUES (
      v_tenant_id,
      p_amount,
      p_grant_type,
      p_admin_user_id,
      p_expires_at,
      p_notes
    );
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- ============================================================================
-- UPDATE GRANT_FREE_CREDITS TO USE NEW DEFAULT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.grant_free_credits(
  p_tenant_id UUID,
  p_amount INTEGER DEFAULT 500  -- Changed from 10000 to 500 for aggressive monetization
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
BEGIN
  -- Get or create credit record
  INSERT INTO public.tenant_credits (tenant_id, balance, lifetime_earned)
  VALUES (p_tenant_id, p_amount, p_amount)
  ON CONFLICT (tenant_id) DO UPDATE SET
    balance = tenant_credits.balance + p_amount,
    lifetime_earned = tenant_credits.lifetime_earned + p_amount,
    last_free_grant_at = now(),
    next_free_grant_at = now() + interval '30 days',
    credits_used_this_month = 0,
    warning_25_sent = false,
    warning_10_sent = false,
    warning_5_sent = false,
    warning_0_sent = false,
    alerts_sent = '{}',
    upgrade_triggers_shown = '{}',
    updated_at = now()
  RETURNING balance INTO v_new_balance;
  
  -- Record transaction
  INSERT INTO public.credit_transactions (
    tenant_id,
    amount,
    balance_after,
    transaction_type,
    description
  ) VALUES (
    p_tenant_id,
    p_amount,
    v_new_balance,
    'free_grant',
    'Monthly free credit grant'
  );
  
  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.reset_daily_credits IS 'Resets credits_used_today for all tenants, called by cron at midnight';
COMMENT ON FUNCTION public.reset_weekly_credits IS 'Resets credits_used_this_week for all tenants, called by cron Sunday midnight';
COMMENT ON FUNCTION public.admin_adjust_credits IS 'Allows super admins to manually adjust tenant credit balances';
COMMENT ON FUNCTION public.get_platform_credit_stats IS 'Returns platform-wide credit statistics for super admin dashboard';
COMMENT ON FUNCTION public.get_tenants_with_credits IS 'Returns paginated list of tenants with credit info for super admin';
COMMENT ON FUNCTION public.grant_bulk_credits IS 'Grants credits to multiple tenants at once';








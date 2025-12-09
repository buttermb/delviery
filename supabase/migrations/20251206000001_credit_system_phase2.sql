-- Credit System Phase 2 Enhancements
-- Adds support for:
-- - Alert tracking (alerts_sent)
-- - Auto top-up configuration
-- - Referral credits
-- - Promo codes
-- - Credit expiration

-- ============================================================================
-- Add alerts_sent column to track which notifications have been sent
-- ============================================================================
ALTER TABLE public.tenant_credits
ADD COLUMN IF NOT EXISTS alerts_sent JSONB DEFAULT '{}';

COMMENT ON COLUMN public.tenant_credits.alerts_sent IS 'Tracks which credit warning alerts have been sent to prevent duplicates';

-- ============================================================================
-- Auto Top-Up Configuration Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.credit_auto_topup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  trigger_threshold INTEGER NOT NULL DEFAULT 500,
  topup_amount INTEGER NOT NULL DEFAULT 5000,
  max_per_month INTEGER NOT NULL DEFAULT 3,
  topups_this_month INTEGER DEFAULT 0,
  month_reset_at TIMESTAMPTZ DEFAULT (date_trunc('month', now()) + interval '1 month'),
  payment_method_id TEXT,
  stripe_customer_id TEXT,
  last_topup_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_credit_auto_topup_tenant ON public.credit_auto_topup(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_auto_topup_enabled ON public.credit_auto_topup(enabled) WHERE enabled = true;

-- Enable RLS
ALTER TABLE public.credit_auto_topup ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_auto_topup
CREATE POLICY "Tenants can view own auto-topup config" ON public.credit_auto_topup
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.profiles WHERE tenant_id = credit_auto_topup.tenant_id
    )
  );

CREATE POLICY "Tenants can update own auto-topup config" ON public.credit_auto_topup
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM public.profiles WHERE tenant_id = credit_auto_topup.tenant_id
    )
  );

CREATE POLICY "Service role full access to auto-topup" ON public.credit_auto_topup
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- Referral System Tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  referrer_bonus INTEGER NOT NULL DEFAULT 2500,
  referee_bonus INTEGER NOT NULL DEFAULT 2500,
  paid_conversion_bonus INTEGER NOT NULL DEFAULT 5000,
  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_tenant ON public.referral_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_active ON public.referral_codes(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.referral_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id UUID REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  referrer_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  referee_tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  referrer_credits_granted INTEGER NOT NULL DEFAULT 0,
  referee_credits_granted INTEGER NOT NULL DEFAULT 0,
  conversion_bonus_granted BOOLEAN DEFAULT false,
  redeemed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_redemptions_referrer ON public.referral_redemptions(referrer_tenant_id);
CREATE INDEX IF NOT EXISTS idx_referral_redemptions_referee ON public.referral_redemptions(referee_tenant_id);

-- Enable RLS
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for referral_codes
CREATE POLICY "Tenants can view own referral codes" ON public.referral_codes
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.profiles WHERE tenant_id = referral_codes.tenant_id
    )
  );

CREATE POLICY "Service role full access to referral_codes" ON public.referral_codes
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for referral_redemptions
CREATE POLICY "Tenants can view own referral redemptions" ON public.referral_redemptions
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.profiles WHERE tenant_id IN (
        referral_redemptions.referrer_tenant_id, 
        referral_redemptions.referee_tenant_id
      )
    )
  );

CREATE POLICY "Service role full access to referral_redemptions" ON public.referral_redemptions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- Promo Codes Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  credits_amount INTEGER NOT NULL,
  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON public.promo_codes(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  credits_granted INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(promo_code_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_tenant ON public.promo_redemptions(tenant_id);

-- Enable RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for promo_codes (read-only for regular users)
CREATE POLICY "Anyone can view active promo codes" ON public.promo_codes
  FOR SELECT USING (is_active = true AND (valid_until IS NULL OR valid_until > now()));

CREATE POLICY "Service role full access to promo_codes" ON public.promo_codes
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for promo_redemptions
CREATE POLICY "Tenants can view own promo redemptions" ON public.promo_redemptions
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.profiles WHERE tenant_id = promo_redemptions.tenant_id
    )
  );

CREATE POLICY "Service role full access to promo_redemptions" ON public.promo_redemptions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- Credit Expiration Tracking
-- ============================================================================
ALTER TABLE public.tenant_credits
ADD COLUMN IF NOT EXISTS purchased_credits_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_credits_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_credits_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rollover_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.tenant_credits.purchased_credits_balance IS 'Balance of purchased credits (never expire)';
COMMENT ON COLUMN public.tenant_credits.free_credits_balance IS 'Balance of free monthly credits (expire on reset)';
COMMENT ON COLUMN public.tenant_credits.free_credits_expires_at IS 'When free credits expire/reset';
COMMENT ON COLUMN public.tenant_credits.rollover_enabled IS 'Whether unused free credits roll over';

-- ============================================================================
-- Functions for Credit System Phase 2
-- ============================================================================

-- Function to generate a unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 8-character alphanumeric code
    v_code := upper(substr(md5(random()::text), 1, 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = v_code) INTO v_exists;
    
    IF NOT v_exists THEN
      -- Insert the new code
      INSERT INTO referral_codes (tenant_id, code)
      VALUES (p_tenant_id, v_code);
      
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;

-- Function to redeem a referral code
CREATE OR REPLACE FUNCTION redeem_referral_code(
  p_referee_tenant_id UUID,
  p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_code referral_codes%ROWTYPE;
  v_referrer_tenant_id UUID;
  v_redemption_id UUID;
BEGIN
  -- Get the referral code
  SELECT * INTO v_referral_code
  FROM referral_codes
  WHERE code = upper(p_code)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR uses_count < max_uses);
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired referral code');
  END IF;
  
  v_referrer_tenant_id := v_referral_code.tenant_id;
  
  -- Don't allow self-referral
  IF v_referrer_tenant_id = p_referee_tenant_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot use your own referral code');
  END IF;
  
  -- Check if already redeemed by this tenant
  IF EXISTS(
    SELECT 1 FROM referral_redemptions 
    WHERE referee_tenant_id = p_referee_tenant_id 
      AND referral_code_id = v_referral_code.id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already redeemed this referral code');
  END IF;
  
  -- Grant credits to referee
  UPDATE tenant_credits
  SET balance = balance + v_referral_code.referee_bonus,
      lifetime_earned = lifetime_earned + v_referral_code.referee_bonus
  WHERE tenant_id = p_referee_tenant_id;
  
  -- Log referee transaction
  INSERT INTO credit_transactions (tenant_id, amount, balance_after, transaction_type, description)
  SELECT p_referee_tenant_id, v_referral_code.referee_bonus, balance, 'bonus', 'Referral signup bonus'
  FROM tenant_credits WHERE tenant_id = p_referee_tenant_id;
  
  -- Grant credits to referrer
  UPDATE tenant_credits
  SET balance = balance + v_referral_code.referrer_bonus,
      lifetime_earned = lifetime_earned + v_referral_code.referrer_bonus
  WHERE tenant_id = v_referrer_tenant_id;
  
  -- Log referrer transaction
  INSERT INTO credit_transactions (tenant_id, amount, balance_after, transaction_type, description)
  SELECT v_referrer_tenant_id, v_referral_code.referrer_bonus, balance, 'bonus', 'Referral reward - new user signup'
  FROM tenant_credits WHERE tenant_id = v_referrer_tenant_id;
  
  -- Record redemption
  INSERT INTO referral_redemptions (
    referral_code_id, 
    referrer_tenant_id, 
    referee_tenant_id,
    referrer_credits_granted,
    referee_credits_granted
  ) VALUES (
    v_referral_code.id,
    v_referrer_tenant_id,
    p_referee_tenant_id,
    v_referral_code.referrer_bonus,
    v_referral_code.referee_bonus
  ) RETURNING id INTO v_redemption_id;
  
  -- Update uses count
  UPDATE referral_codes
  SET uses_count = uses_count + 1
  WHERE id = v_referral_code.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'credits_granted', v_referral_code.referee_bonus,
    'referrer_credits', v_referral_code.referrer_bonus
  );
END;
$$;

-- Function to redeem a promo code
CREATE OR REPLACE FUNCTION redeem_promo_code(
  p_tenant_id UUID,
  p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo promo_codes%ROWTYPE;
  v_redemption_id UUID;
BEGIN
  -- Get the promo code
  SELECT * INTO v_promo
  FROM promo_codes
  WHERE code = upper(p_code)
    AND is_active = true
    AND valid_from <= now()
    AND (valid_until IS NULL OR valid_until > now())
    AND (max_uses IS NULL OR uses_count < max_uses);
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired promo code');
  END IF;
  
  -- Check if already redeemed by this tenant
  IF EXISTS(
    SELECT 1 FROM promo_redemptions 
    WHERE tenant_id = p_tenant_id AND promo_code_id = v_promo.id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already redeemed this promo code');
  END IF;
  
  -- Grant credits
  UPDATE tenant_credits
  SET balance = balance + v_promo.credits_amount,
      lifetime_earned = lifetime_earned + v_promo.credits_amount
  WHERE tenant_id = p_tenant_id;
  
  -- Log transaction
  INSERT INTO credit_transactions (tenant_id, amount, balance_after, transaction_type, description, metadata)
  SELECT p_tenant_id, v_promo.credits_amount, balance, 'promo', 
         'Promo code: ' || v_promo.code,
         jsonb_build_object('promo_code_id', v_promo.id, 'code', v_promo.code)
  FROM tenant_credits WHERE tenant_id = p_tenant_id;
  
  -- Record redemption
  INSERT INTO promo_redemptions (promo_code_id, tenant_id, credits_granted)
  VALUES (v_promo.id, p_tenant_id, v_promo.credits_amount)
  RETURNING id INTO v_redemption_id;
  
  -- Update uses count
  UPDATE promo_codes
  SET uses_count = uses_count + 1
  WHERE id = v_promo.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'credits_granted', v_promo.credits_amount,
    'promo_code', v_promo.code
  );
END;
$$;

-- Function to process auto top-up
CREATE OR REPLACE FUNCTION check_auto_topup(p_tenant_id UUID, p_current_balance INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config credit_auto_topup%ROWTYPE;
BEGIN
  -- Get auto top-up config
  SELECT * INTO v_config
  FROM credit_auto_topup
  WHERE tenant_id = p_tenant_id
    AND enabled = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('should_topup', false, 'reason', 'not_enabled');
  END IF;
  
  -- Check if below threshold
  IF p_current_balance > v_config.trigger_threshold THEN
    RETURN jsonb_build_object('should_topup', false, 'reason', 'above_threshold');
  END IF;
  
  -- Check if max reached this month
  IF v_config.topups_this_month >= v_config.max_per_month THEN
    RETURN jsonb_build_object('should_topup', false, 'reason', 'max_reached');
  END IF;
  
  -- Check if payment method exists
  IF v_config.payment_method_id IS NULL THEN
    RETURN jsonb_build_object('should_topup', false, 'reason', 'no_payment_method');
  END IF;
  
  RETURN jsonb_build_object(
    'should_topup', true,
    'topup_amount', v_config.topup_amount,
    'payment_method_id', v_config.payment_method_id,
    'stripe_customer_id', v_config.stripe_customer_id
  );
END;
$$;

-- Function to record auto top-up after successful payment
CREATE OR REPLACE FUNCTION record_auto_topup(
  p_tenant_id UUID,
  p_credits_amount INTEGER,
  p_stripe_payment_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update credits balance
  UPDATE tenant_credits
  SET balance = balance + p_credits_amount,
      purchased_credits_balance = purchased_credits_balance + p_credits_amount,
      lifetime_earned = lifetime_earned + p_credits_amount
  WHERE tenant_id = p_tenant_id;
  
  -- Log transaction
  INSERT INTO credit_transactions (tenant_id, amount, balance_after, transaction_type, description, metadata)
  SELECT p_tenant_id, p_credits_amount, balance, 'purchase', 
         'Auto top-up',
         jsonb_build_object('auto_topup', true, 'stripe_payment_id', p_stripe_payment_id)
  FROM tenant_credits WHERE tenant_id = p_tenant_id;
  
  -- Update auto top-up record
  UPDATE credit_auto_topup
  SET topups_this_month = topups_this_month + 1,
      last_topup_at = now()
  WHERE tenant_id = p_tenant_id;
END;
$$;

-- Function to reset monthly auto top-up counter
CREATE OR REPLACE FUNCTION reset_monthly_topup_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE credit_auto_topup
  SET topups_this_month = 0,
      month_reset_at = date_trunc('month', now()) + interval '1 month'
  WHERE month_reset_at <= now();
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_referral_code(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION redeem_referral_code(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION redeem_promo_code(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_auto_topup(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION record_auto_topup(UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION reset_monthly_topup_counters() TO service_role;








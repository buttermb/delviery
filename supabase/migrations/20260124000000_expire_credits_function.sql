-- ============================================================================
-- CREDIT EXPIRATION SYSTEM
-- ============================================================================
-- 1. Creates credit_expiration_rules table for configurable expiration policies
-- 2. Adds lifetime_expired column to tenant_credits
-- 3. Adds 'expiration' to credit_transactions transaction_type CHECK
-- 4. Creates expire_credits() function for nightly pg_cron execution
-- 5. Schedules pg_cron job to run nightly at midnight UTC
-- ============================================================================

-- ============================================================================
-- 1. CREDIT EXPIRATION RULES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.credit_expiration_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  days_until_expiration INTEGER NOT NULL CHECK (days_until_expiration > 0),
  applies_to TEXT NOT NULL CHECK (applies_to IN ('purchased', 'bonus', 'promotional', 'subscription')),
  warning_days_before INTEGER[] DEFAULT ARRAY[30, 7, 1],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_expiration_rules_tenant_id
  ON public.credit_expiration_rules(tenant_id);

CREATE INDEX IF NOT EXISTS idx_credit_expiration_rules_active
  ON public.credit_expiration_rules(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.credit_expiration_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenants can view own expiration rules" ON public.credit_expiration_rules
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.profiles WHERE tenant_id = credit_expiration_rules.tenant_id
    )
  );

CREATE POLICY "Service role full access to credit_expiration_rules" ON public.credit_expiration_rules
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

COMMENT ON TABLE public.credit_expiration_rules IS 'Configurable rules for credit expiration per tenant';
COMMENT ON COLUMN public.credit_expiration_rules.applies_to IS 'Credit type this rule applies to: purchased, bonus, promotional, subscription';
COMMENT ON COLUMN public.credit_expiration_rules.warning_days_before IS 'Array of days before expiration to send warnings';

-- ============================================================================
-- 2. ADD lifetime_expired COLUMN TO tenant_credits
-- ============================================================================

ALTER TABLE public.tenant_credits
ADD COLUMN IF NOT EXISTS lifetime_expired INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.tenant_credits.lifetime_expired IS 'Total credits expired over the lifetime of the account';

-- ============================================================================
-- 3. ADD 'expiration' TO credit_transactions transaction_type CHECK
-- ============================================================================

-- Drop old constraint and recreate with 'expiration' included
ALTER TABLE public.credit_transactions
DROP CONSTRAINT IF EXISTS credit_transactions_transaction_type_check;

ALTER TABLE public.credit_transactions
ADD CONSTRAINT credit_transactions_transaction_type_check
CHECK (transaction_type IN (
  'free_grant', 'purchase', 'usage', 'refund', 'bonus',
  'adjustment', 'signup_bonus', 'promo', 'expiration'
));

-- ============================================================================
-- 4. CREATE expire_credits() FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.expire_credits()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant RECORD;
  v_rule RECORD;
  v_tenant_credit RECORD;
  v_expired_amount INTEGER;
  v_new_balance INTEGER;
  v_total_expired INTEGER := 0;
  v_total_grants_expired INTEGER := 0;
  v_expiration_log JSONB := '[]'::JSONB;
BEGIN
  -- ========================================================================
  -- PHASE 1: Expire credit_grants with explicit expires_at dates
  -- ========================================================================
  FOR v_grant IN
    SELECT
      cg.id AS grant_id,
      cg.tenant_id,
      cg.amount,
      cg.grant_type,
      cg.expires_at
    FROM public.credit_grants cg
    WHERE cg.expires_at IS NOT NULL
      AND cg.expires_at <= now()
      AND cg.is_used = false
    ORDER BY cg.expires_at ASC
  LOOP
    -- Get current tenant credit balance
    SELECT * INTO v_tenant_credit
    FROM public.tenant_credits
    WHERE tenant_id = v_grant.tenant_id
    FOR UPDATE;

    IF v_tenant_credit IS NULL THEN
      CONTINUE;
    END IF;

    -- Calculate expired amount (cannot exceed current balance)
    v_expired_amount := LEAST(v_grant.amount, v_tenant_credit.balance);

    IF v_expired_amount <= 0 THEN
      -- Mark the grant as used even if no balance to expire
      UPDATE public.credit_grants
      SET is_used = true, used_at = now()
      WHERE id = v_grant.grant_id;
      CONTINUE;
    END IF;

    -- Calculate new balance
    v_new_balance := v_tenant_credit.balance - v_expired_amount;

    -- Update tenant_credits balance and lifetime_expired
    UPDATE public.tenant_credits
    SET
      balance = v_new_balance,
      lifetime_expired = lifetime_expired + v_expired_amount,
      updated_at = now()
    WHERE tenant_id = v_grant.tenant_id;

    -- Create expiration transaction
    INSERT INTO public.credit_transactions (
      tenant_id, amount, balance_after, transaction_type,
      action_type, reference_id, reference_type, description, metadata
    ) VALUES (
      v_grant.tenant_id,
      -v_expired_amount,
      v_new_balance,
      'expiration',
      'credit_expiration',
      v_grant.grant_id,
      'credit_grant',
      format('Expired %s credits from %s grant (expired at %s)',
        v_expired_amount, v_grant.grant_type, v_grant.expires_at),
      jsonb_build_object(
        'grant_id', v_grant.grant_id,
        'grant_type', v_grant.grant_type,
        'original_amount', v_grant.amount,
        'expired_amount', v_expired_amount,
        'expires_at', v_grant.expires_at,
        'expiration_source', 'credit_grant'
      )
    );

    -- Mark grant as used
    UPDATE public.credit_grants
    SET is_used = true, used_at = now()
    WHERE id = v_grant.grant_id;

    -- Track totals
    v_total_expired := v_total_expired + v_expired_amount;
    v_total_grants_expired := v_total_grants_expired + 1;

    -- Add to log
    v_expiration_log := v_expiration_log || jsonb_build_object(
      'tenant_id', v_grant.tenant_id,
      'grant_id', v_grant.grant_id,
      'grant_type', v_grant.grant_type,
      'expired_amount', v_expired_amount,
      'source', 'credit_grant'
    );
  END LOOP;

  -- ========================================================================
  -- PHASE 2: Expire credits based on credit_expiration_rules
  -- ========================================================================
  -- For each active rule, find grants of the matching type that have been
  -- granted more than days_until_expiration days ago and haven't been used
  FOR v_rule IN
    SELECT
      cer.id AS rule_id,
      cer.tenant_id,
      cer.name AS rule_name,
      cer.days_until_expiration,
      cer.applies_to
    FROM public.credit_expiration_rules cer
    WHERE cer.is_active = true
  LOOP
    -- Find grants matching the rule's applies_to type that are past expiration
    FOR v_grant IN
      SELECT
        cg.id AS grant_id,
        cg.tenant_id,
        cg.amount,
        cg.grant_type,
        cg.granted_at
      FROM public.credit_grants cg
      WHERE cg.tenant_id = v_rule.tenant_id
        AND cg.is_used = false
        AND cg.expires_at IS NULL  -- Only grants without explicit expiry
        AND (
          (v_rule.applies_to = 'bonus' AND cg.grant_type IN ('signup_bonus', 'loyalty', 'compensation', 'support'))
          OR (v_rule.applies_to = 'promotional' AND cg.grant_type IN ('promo_code', 'referral'))
          OR (v_rule.applies_to = 'purchased' AND cg.grant_type = 'admin_grant')
        )
        AND cg.granted_at + (v_rule.days_until_expiration || ' days')::INTERVAL <= now()
      ORDER BY cg.granted_at ASC
    LOOP
      -- Get current tenant credit balance
      SELECT * INTO v_tenant_credit
      FROM public.tenant_credits
      WHERE tenant_id = v_grant.tenant_id
      FOR UPDATE;

      IF v_tenant_credit IS NULL THEN
        CONTINUE;
      END IF;

      -- Calculate expired amount (cannot exceed current balance)
      v_expired_amount := LEAST(v_grant.amount, v_tenant_credit.balance);

      IF v_expired_amount <= 0 THEN
        UPDATE public.credit_grants
        SET is_used = true, used_at = now()
        WHERE id = v_grant.grant_id;
        CONTINUE;
      END IF;

      -- Calculate new balance
      v_new_balance := v_tenant_credit.balance - v_expired_amount;

      -- Update tenant_credits balance and lifetime_expired
      UPDATE public.tenant_credits
      SET
        balance = v_new_balance,
        lifetime_expired = lifetime_expired + v_expired_amount,
        updated_at = now()
      WHERE tenant_id = v_grant.tenant_id;

      -- Create expiration transaction
      INSERT INTO public.credit_transactions (
        tenant_id, amount, balance_after, transaction_type,
        action_type, reference_id, reference_type, description, metadata
      ) VALUES (
        v_grant.tenant_id,
        -v_expired_amount,
        v_new_balance,
        'expiration',
        'credit_expiration',
        v_grant.grant_id,
        'credit_grant',
        format('Expired %s credits from %s grant per rule "%s" (%s days)',
          v_expired_amount, v_grant.grant_type, v_rule.rule_name, v_rule.days_until_expiration),
        jsonb_build_object(
          'grant_id', v_grant.grant_id,
          'grant_type', v_grant.grant_type,
          'rule_id', v_rule.rule_id,
          'rule_name', v_rule.rule_name,
          'days_until_expiration', v_rule.days_until_expiration,
          'original_amount', v_grant.amount,
          'expired_amount', v_expired_amount,
          'granted_at', v_grant.granted_at,
          'expiration_source', 'expiration_rule'
        )
      );

      -- Mark grant as used
      UPDATE public.credit_grants
      SET is_used = true, used_at = now()
      WHERE id = v_grant.grant_id;

      -- Track totals
      v_total_expired := v_total_expired + v_expired_amount;
      v_total_grants_expired := v_total_grants_expired + 1;

      -- Add to log
      v_expiration_log := v_expiration_log || jsonb_build_object(
        'tenant_id', v_grant.tenant_id,
        'grant_id', v_grant.grant_id,
        'grant_type', v_grant.grant_type,
        'rule_id', v_rule.rule_id,
        'rule_name', v_rule.rule_name,
        'expired_amount', v_expired_amount,
        'source', 'expiration_rule'
      );
    END LOOP;
  END LOOP;

  -- ========================================================================
  -- PHASE 3: Expire free credits with explicit free_credits_expires_at
  -- ========================================================================
  FOR v_tenant_credit IN
    SELECT *
    FROM public.tenant_credits
    WHERE free_credits_expires_at IS NOT NULL
      AND free_credits_expires_at <= now()
      AND COALESCE(free_credits_balance, 0) > 0
    FOR UPDATE
  LOOP
    v_expired_amount := LEAST(
      COALESCE(v_tenant_credit.free_credits_balance, 0),
      v_tenant_credit.balance
    );

    IF v_expired_amount <= 0 THEN
      -- Clear the expiry date even if no balance
      UPDATE public.tenant_credits
      SET
        free_credits_balance = 0,
        free_credits_expires_at = NULL,
        updated_at = now()
      WHERE tenant_id = v_tenant_credit.tenant_id;
      CONTINUE;
    END IF;

    v_new_balance := v_tenant_credit.balance - v_expired_amount;

    -- Update tenant_credits
    UPDATE public.tenant_credits
    SET
      balance = v_new_balance,
      free_credits_balance = 0,
      free_credits_expires_at = NULL,
      lifetime_expired = lifetime_expired + v_expired_amount,
      updated_at = now()
    WHERE tenant_id = v_tenant_credit.tenant_id;

    -- Create expiration transaction
    INSERT INTO public.credit_transactions (
      tenant_id, amount, balance_after, transaction_type,
      action_type, description, metadata
    ) VALUES (
      v_tenant_credit.tenant_id,
      -v_expired_amount,
      v_new_balance,
      'expiration',
      'free_credits_expiration',
      format('Expired %s free credits (expired at %s)',
        v_expired_amount, v_tenant_credit.free_credits_expires_at),
      jsonb_build_object(
        'expired_amount', v_expired_amount,
        'free_credits_expires_at', v_tenant_credit.free_credits_expires_at,
        'expiration_source', 'free_credits'
      )
    );

    v_total_expired := v_total_expired + v_expired_amount;
    v_total_grants_expired := v_total_grants_expired + 1;

    v_expiration_log := v_expiration_log || jsonb_build_object(
      'tenant_id', v_tenant_credit.tenant_id,
      'expired_amount', v_expired_amount,
      'source', 'free_credits'
    );
  END LOOP;

  -- Return summary
  RETURN jsonb_build_object(
    'success', true,
    'total_credits_expired', v_total_expired,
    'total_grants_expired', v_total_grants_expired,
    'executed_at', now(),
    'details', v_expiration_log
  );
END;
$$;

COMMENT ON FUNCTION public.expire_credits() IS 'Nightly job to expire credits based on expiration rules and explicit expiry dates. Creates expiration transactions and updates balances.';

-- ============================================================================
-- 5. SCHEDULE PG_CRON JOB (runs nightly at midnight UTC)
-- ============================================================================
-- Note: pg_cron extension must be enabled. This will be a no-op if not available.

DO $$
BEGIN
  -- Check if pg_cron extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists
    PERFORM cron.unschedule('expire_credits_nightly')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'expire_credits_nightly'
    );

    -- Schedule nightly at midnight UTC
    PERFORM cron.schedule(
      'expire_credits_nightly',
      '0 0 * * *',
      $$SELECT public.expire_credits();$$
    );
  END IF;
END;
$$;

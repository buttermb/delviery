-- ============================================================================
-- CREDIT EXPIRATION RULES TABLE + NIGHTLY EXPIRATION CRON JOB
-- ============================================================================
-- Creates a configurable credit expiration rules system that allows tenants
-- to define expiration policies for different credit types (purchased, bonus,
-- promotional, subscription). A pg_cron job runs nightly to expire credits
-- based on these rules.
-- ============================================================================

-- ============================================================================
-- 1. CREATE credit_expiration_rules TABLE
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credit_expiration_rules_tenant_id
  ON public.credit_expiration_rules(tenant_id);

CREATE INDEX IF NOT EXISTS idx_credit_expiration_rules_applies_to
  ON public.credit_expiration_rules(applies_to);

CREATE INDEX IF NOT EXISTS idx_credit_expiration_rules_active
  ON public.credit_expiration_rules(is_active)
  WHERE is_active = true;

-- ============================================================================
-- 2. ENABLE RLS
-- ============================================================================

ALTER TABLE public.credit_expiration_rules ENABLE ROW LEVEL SECURITY;

-- Tenants can view their own expiration rules
CREATE POLICY "credit_expiration_rules_select_tenant"
  ON public.credit_expiration_rules
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.id = auth.uid()::text::uuid
    )
  );

-- Tenants can insert their own expiration rules
CREATE POLICY "credit_expiration_rules_insert_tenant"
  ON public.credit_expiration_rules
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.id = auth.uid()::text::uuid
    )
  );

-- Tenants can update their own expiration rules
CREATE POLICY "credit_expiration_rules_update_tenant"
  ON public.credit_expiration_rules
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.id = auth.uid()::text::uuid
    )
  );

-- Tenants can delete their own expiration rules
CREATE POLICY "credit_expiration_rules_delete_tenant"
  ON public.credit_expiration_rules
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.id = auth.uid()::text::uuid
    )
  );

-- Service role full access
CREATE POLICY "credit_expiration_rules_service_role"
  ON public.credit_expiration_rules
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 3. NIGHTLY CREDIT EXPIRATION FUNCTION
-- ============================================================================
-- Expires credits in credit_grants based on active expiration rules.
-- For each active rule, finds credit_grants that:
--   - Belong to the rule's tenant
--   - Match the grant_type (mapped from applies_to)
--   - Were granted more than days_until_expiration days ago
--   - Have not already been used or expired
-- Then marks them as used and records an expiration transaction.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.expire_credits_nightly()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_grant RECORD;
  v_total_expired INTEGER := 0;
  v_total_grants_expired INTEGER := 0;
  v_grant_type_mapping TEXT;
  v_result JSONB := '{}'::jsonb;
BEGIN
  -- Iterate over all active expiration rules
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
    -- Map applies_to to credit_grants.grant_type values
    CASE v_rule.applies_to
      WHEN 'purchased' THEN v_grant_type_mapping := 'admin_grant';
      WHEN 'bonus' THEN v_grant_type_mapping := 'signup_bonus';
      WHEN 'promotional' THEN v_grant_type_mapping := 'promo_code';
      WHEN 'subscription' THEN v_grant_type_mapping := 'loyalty';
      ELSE v_grant_type_mapping := v_rule.applies_to;
    END CASE;

    -- Find and expire matching grants
    FOR v_grant IN
      SELECT cg.id, cg.tenant_id, cg.amount
      FROM public.credit_grants cg
      WHERE cg.tenant_id = v_rule.tenant_id
        AND cg.grant_type = v_grant_type_mapping
        AND cg.is_used = false
        AND cg.granted_at + (v_rule.days_until_expiration || ' days')::INTERVAL <= now()
        AND (cg.expires_at IS NULL OR cg.expires_at <= now())
      FOR UPDATE SKIP LOCKED
    LOOP
      -- Mark grant as used (expired)
      UPDATE public.credit_grants
      SET
        is_used = true,
        used_at = now(),
        notes = COALESCE(notes, '') || ' [Expired by rule: ' || v_rule.rule_name || ']'
      WHERE id = v_grant.id;

      -- Deduct expired amount from tenant balance
      UPDATE public.tenant_credits
      SET
        balance = GREATEST(0, balance - v_grant.amount),
        updated_at = now()
      WHERE tenant_id = v_grant.tenant_id;

      -- Record expiration transaction
      INSERT INTO public.credit_transactions (
        tenant_id,
        amount,
        balance_after,
        transaction_type,
        description,
        metadata
      ) VALUES (
        v_grant.tenant_id,
        -v_grant.amount,
        (SELECT balance FROM public.tenant_credits WHERE tenant_id = v_grant.tenant_id),
        'adjustment',
        'Credits expired per rule: ' || v_rule.rule_name,
        jsonb_build_object(
          'expiration_rule_id', v_rule.rule_id,
          'expiration_rule_name', v_rule.rule_name,
          'grant_id', v_grant.id,
          'applies_to', v_rule.applies_to,
          'days_until_expiration', v_rule.days_until_expiration
        )
      );

      v_total_expired := v_total_expired + v_grant.amount;
      v_total_grants_expired := v_total_grants_expired + 1;
    END LOOP;
  END LOOP;

  v_result := jsonb_build_object(
    'total_credits_expired', v_total_expired,
    'total_grants_expired', v_total_grants_expired,
    'executed_at', now()
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.expire_credits_nightly IS 'Nightly job: expires credit grants based on active credit_expiration_rules per tenant';

-- ============================================================================
-- 4. SCHEDULE PG_CRON JOB - Run nightly at 2:00 AM UTC
-- ============================================================================

-- Ensure pg_cron extension is available
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if any (idempotent)
SELECT cron.unschedule('expire-credits-nightly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'expire-credits-nightly'
);

-- Schedule nightly at 2:00 AM UTC
SELECT cron.schedule(
  'expire-credits-nightly',
  '0 2 * * *',
  $$SELECT public.expire_credits_nightly()$$
);

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.credit_expiration_rules IS 'Configurable per-tenant rules for automatic credit expiration based on credit type and age';
COMMENT ON COLUMN public.credit_expiration_rules.applies_to IS 'Credit type this rule applies to: purchased, bonus, promotional, or subscription';
COMMENT ON COLUMN public.credit_expiration_rules.warning_days_before IS 'Array of days before expiration to send warning notifications';
COMMENT ON COLUMN public.credit_expiration_rules.days_until_expiration IS 'Number of days after grant before credits expire (must be > 0)';

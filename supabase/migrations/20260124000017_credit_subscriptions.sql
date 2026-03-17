-- ============================================================================
-- Credit Subscriptions System
-- ============================================================================
-- Creates the credit_subscriptions table for recurring credit grants.
-- Also adds package_type and billing_interval to credit_packages to support
-- subscription-type packages alongside one-time purchase packs.
-- ============================================================================

-- Add subscription-related columns to credit_packages
ALTER TABLE public.credit_packages
  ADD COLUMN IF NOT EXISTS package_type TEXT NOT NULL DEFAULT 'one_time'
    CHECK (package_type IN ('one_time', 'subscription')),
  ADD COLUMN IF NOT EXISTS billing_interval TEXT
    CHECK (billing_interval IN ('monthly', 'yearly', 'weekly')),
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT;

-- Credit subscriptions table
CREATE TABLE IF NOT EXISTS public.credit_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  package_id UUID REFERENCES public.credit_packages(id),
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled', 'past_due', 'trialing')),
  credits_per_period INTEGER NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'yearly', 'weekly')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  credits_remaining_this_period INTEGER,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credit_subscriptions_user_id
  ON public.credit_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_subscriptions_tenant_id
  ON public.credit_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_subscriptions_status
  ON public.credit_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_credit_subscriptions_stripe_subscription_id
  ON public.credit_subscriptions(stripe_subscription_id);

-- Enable RLS
ALTER TABLE public.credit_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenants can view own subscriptions" ON public.credit_subscriptions
  FOR SELECT USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all subscriptions" ON public.credit_subscriptions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_credit_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_credit_subscriptions_updated_at
  BEFORE UPDATE ON public.credit_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_credit_subscriptions_updated_at();

-- Comments
COMMENT ON TABLE public.credit_subscriptions IS 'Tracks recurring credit subscriptions for tenants';
COMMENT ON COLUMN public.credit_packages.package_type IS 'Whether this package is a one-time purchase or subscription';
COMMENT ON COLUMN public.credit_packages.billing_interval IS 'Billing interval for subscription packages (monthly, yearly, weekly)';

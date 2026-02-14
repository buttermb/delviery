-- ============================================================================
-- Credit Subscriptions Table
-- Tracks recurring credit subscriptions tied to Stripe billing
-- ============================================================================

-- Create the credit_subscriptions table
CREATE TABLE IF NOT EXISTS public.credit_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.credit_packages(id) ON DELETE SET NULL,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'cancelled', 'past_due', 'trialing')),
  credits_per_period INTEGER NOT NULL,
  period_type TEXT CHECK (period_type IN ('monthly', 'yearly', 'weekly')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  credits_remaining_this_period INTEGER,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add table comment
COMMENT ON TABLE public.credit_subscriptions IS 'Tracks recurring credit subscriptions for tenants, linked to Stripe billing';

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_credit_subscriptions_user_id
  ON public.credit_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_subscriptions_tenant_id
  ON public.credit_subscriptions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_credit_subscriptions_package_id
  ON public.credit_subscriptions(package_id);

CREATE INDEX IF NOT EXISTS idx_credit_subscriptions_status
  ON public.credit_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_credit_subscriptions_stripe_subscription_id
  ON public.credit_subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_credit_subscriptions_current_period_end
  ON public.credit_subscriptions(current_period_end);

-- Composite index for tenant + status lookups
CREATE INDEX IF NOT EXISTS idx_credit_subscriptions_tenant_status
  ON public.credit_subscriptions(tenant_id, status);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE public.credit_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY credit_subscriptions_select_own
  ON public.credit_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own subscriptions
CREATE POLICY credit_subscriptions_insert_own
  ON public.credit_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscriptions
CREATE POLICY credit_subscriptions_update_own
  ON public.credit_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role has full access (for Stripe webhooks and Edge Functions)
-- Note: service_role bypasses RLS by default in Supabase

-- ============================================================================
-- Updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_credit_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER credit_subscriptions_updated_at
  BEFORE UPDATE ON public.credit_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_credit_subscriptions_updated_at();

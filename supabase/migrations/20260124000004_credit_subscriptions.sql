-- Credit Subscriptions table
-- Tracks recurring credit subscription plans tied to Stripe subscriptions
-- Supports monthly/yearly/weekly billing cycles with per-period credit grants

CREATE TABLE IF NOT EXISTS public.credit_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.credit_packages(id) ON DELETE SET NULL,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'past_due', 'trialing')),
  credits_per_period INTEGER NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'yearly', 'weekly')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  credits_remaining_this_period INTEGER,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credit_subscriptions_tenant_id ON public.credit_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_subscriptions_user_id ON public.credit_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_subscriptions_stripe_subscription_id ON public.credit_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_credit_subscriptions_status ON public.credit_subscriptions(status);

-- Enable RLS
ALTER TABLE public.credit_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own credit subscriptions"
  ON public.credit_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage credit subscriptions"
  ON public.credit_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_credit_subscriptions_updated_at()
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

CREATE TRIGGER trigger_credit_subscriptions_updated_at
  BEFORE UPDATE ON public.credit_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_credit_subscriptions_updated_at();

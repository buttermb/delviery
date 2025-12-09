-- ============================================================================
-- Credit Purchase Flow: RPC Function + Seed Credit Packages
-- ============================================================================

-- 1. Add 'slug' column to credit_packages if it doesn't exist
ALTER TABLE public.credit_packages 
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- 2. Add description column if missing
ALTER TABLE public.credit_packages 
ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. Create purchase_credits RPC function
CREATE OR REPLACE FUNCTION public.purchase_credits(
  p_tenant_id UUID,
  p_amount INTEGER,
  p_stripe_payment_id TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Insert or update tenant_credits
  INSERT INTO tenant_credits (tenant_id, balance, updated_at)
  VALUES (p_tenant_id, p_amount, now())
  ON CONFLICT (tenant_id) 
  DO UPDATE SET 
    balance = tenant_credits.balance + p_amount,
    updated_at = now();

  -- Get new balance
  SELECT balance INTO v_new_balance
  FROM tenant_credits
  WHERE tenant_id = p_tenant_id;

  -- Record transaction
  INSERT INTO credit_transactions (
    tenant_id,
    transaction_type,
    amount,
    balance_after,
    description,
    reference_type,
    reference_id,
    created_at
  ) VALUES (
    p_tenant_id,
    'purchase',
    p_amount,
    v_new_balance,
    'Credit package purchase',
    'stripe_payment',
    p_stripe_payment_id,
    now()
  );

  RETURN v_new_balance;
END;
$$;

-- 4. Grant execute permission
GRANT EXECUTE ON FUNCTION public.purchase_credits TO service_role;

-- 5. Clear and seed credit packages
DELETE FROM public.credit_packages WHERE slug IN ('starter-pack', 'growth-pack', 'power-pack');

INSERT INTO public.credit_packages (name, slug, credits, price_cents, bonus_credits, description, is_active, sort_order)
VALUES 
  ('Starter Pack', 'starter-pack', 1000, 1000, 0, '1,000 credits for $10 (1¢/credit)', true, 1),
  ('Growth Pack', 'growth-pack', 5000, 4500, 0, '5,000 credits for $45 (0.9¢/credit) - Best Value', true, 2),
  ('Power Pack', 'power-pack', 10000, 8000, 0, '10,000 credits for $80 (0.8¢/credit)', true, 3);

-- 6. Create credit_analytics table if missing (for tracking)
CREATE TABLE IF NOT EXISTS public.credit_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policy for credit_analytics
DROP POLICY IF EXISTS "Tenants can view own credit_analytics" ON public.credit_analytics;
CREATE POLICY "Tenants can view own credit_analytics"
  ON public.credit_analytics FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "System can insert credit_analytics" ON public.credit_analytics;
CREATE POLICY "System can insert credit_analytics"
  ON public.credit_analytics FOR INSERT
  WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_credit_analytics_tenant_id ON public.credit_analytics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_packages_slug ON public.credit_packages(slug);
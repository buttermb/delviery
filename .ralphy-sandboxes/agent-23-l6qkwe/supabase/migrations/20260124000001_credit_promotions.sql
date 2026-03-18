-- Credit Promotions table for promo codes that discount credit package purchases
-- Supports percentage, fixed_credits, and multiplier discount types

CREATE TABLE IF NOT EXISTS public.credit_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_credits', 'multiplier')),
  value INTEGER NOT NULL,
  min_purchase_credits INTEGER,
  max_discount_credits INTEGER,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  per_user_limit INTEGER DEFAULT 1,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- Track per-user usage of credit promotions
CREATE TABLE IF NOT EXISTS public.credit_promotion_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.credit_promotions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.credit_packages(id) ON DELETE CASCADE,
  discount_amount INTEGER NOT NULL,
  used_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_credit_promotions_tenant ON public.credit_promotions(tenant_id);
CREATE INDEX idx_credit_promotions_code ON public.credit_promotions(code);
CREATE INDEX idx_credit_promotions_active ON public.credit_promotions(is_active) WHERE is_active = true;
CREATE INDEX idx_credit_promotion_usage_user ON public.credit_promotion_usage(user_id);
CREATE INDEX idx_credit_promotion_usage_promo ON public.credit_promotion_usage(promotion_id);

-- Enable RLS
ALTER TABLE public.credit_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_promotion_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_promotions
CREATE POLICY "Authenticated users can view active promotions"
  ON public.credit_promotions FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

CREATE POLICY "Service role has full access to promotions"
  ON public.credit_promotions FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for credit_promotion_usage
CREATE POLICY "Users can view own promotion usage"
  ON public.credit_promotion_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to promotion usage"
  ON public.credit_promotion_usage FOR ALL
  USING (true)
  WITH CHECK (true);

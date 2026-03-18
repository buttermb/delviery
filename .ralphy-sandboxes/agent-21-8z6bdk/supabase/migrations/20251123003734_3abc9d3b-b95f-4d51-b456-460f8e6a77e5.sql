-- Create loyalty program configuration table
CREATE TABLE IF NOT EXISTS public.loyalty_program_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  points_per_dollar NUMERIC(10,2) DEFAULT 1,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create loyalty tiers table
CREATE TABLE IF NOT EXISTS public.loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  min_points INTEGER NOT NULL,
  benefits JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create customer loyalty points table
CREATE TABLE IF NOT EXISTS public.customer_loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  points INTEGER DEFAULT 0,
  tier_id UUID REFERENCES public.loyalty_tiers(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create loyalty reward redemptions table
CREATE TABLE IF NOT EXISTS public.loyalty_reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  reward_id UUID REFERENCES public.loyalty_rewards(id),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  points_spent INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.loyalty_program_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_reward_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for loyalty_program_config
CREATE POLICY "Tenants manage loyalty config" 
ON public.loyalty_program_config 
FOR ALL 
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- RLS Policies for loyalty_tiers
CREATE POLICY "Tenants manage loyalty tiers" 
ON public.loyalty_tiers 
FOR ALL 
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- RLS Policies for customer_loyalty_points
CREATE POLICY "Tenants view loyalty points" 
ON public.customer_loyalty_points 
FOR ALL 
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- RLS Policies for loyalty_reward_redemptions
CREATE POLICY "Tenants manage redemptions" 
ON public.loyalty_reward_redemptions 
FOR ALL 
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_loyalty_config_tenant ON public.loyalty_program_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_tenant ON public.loyalty_tiers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_points_tenant ON public.customer_loyalty_points(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_points_customer ON public.customer_loyalty_points(customer_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_tenant ON public.loyalty_reward_redemptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_customer ON public.loyalty_reward_redemptions(customer_id);
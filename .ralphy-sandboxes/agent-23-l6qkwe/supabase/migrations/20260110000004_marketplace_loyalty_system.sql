-- Add loyalty points to marketplace customers
-- Enables point-based rewards and redemption at checkout

-- Add loyalty points columns to marketplace_customers
ALTER TABLE public.marketplace_customers
ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS lifetime_points INTEGER DEFAULT 0;

-- Create marketplace loyalty config table (store-specific settings)
CREATE TABLE IF NOT EXISTS public.marketplace_loyalty_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL UNIQUE REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  points_per_dollar NUMERIC(10,2) DEFAULT 1,
  points_to_dollar_ratio INTEGER DEFAULT 100, -- 100 points = $1
  signup_bonus_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create marketplace loyalty rewards table
CREATE TABLE IF NOT EXISTS public.marketplace_loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL,
  reward_type TEXT NOT NULL DEFAULT 'discount', -- 'discount', 'free_product', 'percentage'
  reward_value NUMERIC(10,2), -- Dollar amount or percentage
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for loyalty config
ALTER TABLE public.marketplace_loyalty_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_loyalty_rewards ENABLE ROW LEVEL SECURITY;

-- Public can read loyalty config (for checkout display)
CREATE POLICY "Anyone can read loyalty config"
  ON public.marketplace_loyalty_config FOR SELECT USING (true);

CREATE POLICY "Anyone can read loyalty rewards"
  ON public.marketplace_loyalty_rewards FOR SELECT USING (true);

-- RPC: Get customer loyalty info for checkout
CREATE OR REPLACE FUNCTION get_marketplace_customer_loyalty(
  p_store_id UUID,
  p_email TEXT
)
RETURNS TABLE (
  customer_id UUID,
  loyalty_points INTEGER,
  lifetime_points INTEGER,
  points_to_dollar_ratio INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mc.id as customer_id,
    COALESCE(mc.loyalty_points, 0) as loyalty_points,
    COALESCE(mc.lifetime_points, 0) as lifetime_points,
    COALESCE(lc.points_to_dollar_ratio, 100) as points_to_dollar_ratio
  FROM public.marketplace_customers mc
  LEFT JOIN public.marketplace_loyalty_config lc ON lc.store_id = p_store_id
  WHERE mc.store_id = p_store_id
  AND mc.email = lower(p_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Redeem loyalty points at checkout
CREATE OR REPLACE FUNCTION redeem_marketplace_loyalty_points(
  p_store_id UUID,
  p_customer_email TEXT,
  p_points_to_redeem INTEGER,
  p_order_id UUID DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance INTEGER,
  discount_amount NUMERIC,
  error_message TEXT
) AS $$
DECLARE
  v_customer_id UUID;
  v_current_points INTEGER;
  v_points_to_dollar INTEGER;
  v_discount NUMERIC;
BEGIN
  -- Get customer and their points
  SELECT mc.id, COALESCE(mc.loyalty_points, 0)
  INTO v_customer_id, v_current_points
  FROM public.marketplace_customers mc
  WHERE mc.store_id = p_store_id
  AND mc.email = lower(p_customer_email);

  IF v_customer_id IS NULL THEN
    RETURN QUERY SELECT false, 0, 0::numeric, 'Customer not found'::text;
    RETURN;
  END IF;

  -- Check sufficient points
  IF v_current_points < p_points_to_redeem THEN
    RETURN QUERY SELECT false, v_current_points, 0::numeric, 'Insufficient points'::text;
    RETURN;
  END IF;

  -- Get conversion ratio
  SELECT COALESCE(points_to_dollar_ratio, 100)
  INTO v_points_to_dollar
  FROM public.marketplace_loyalty_config
  WHERE store_id = p_store_id;

  IF v_points_to_dollar IS NULL THEN
    v_points_to_dollar := 100;
  END IF;

  -- Calculate discount
  v_discount := p_points_to_redeem::numeric / v_points_to_dollar;

  -- Deduct points
  UPDATE public.marketplace_customers
  SET loyalty_points = loyalty_points - p_points_to_redeem,
      updated_at = now()
  WHERE id = v_customer_id;

  RETURN QUERY SELECT 
    true, 
    v_current_points - p_points_to_redeem,
    v_discount,
    null::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Add loyalty points after order completion
CREATE OR REPLACE FUNCTION add_marketplace_loyalty_points(
  p_store_id UUID,
  p_customer_email TEXT,
  p_order_total NUMERIC
)
RETURNS INTEGER AS $$
DECLARE
  v_points_per_dollar NUMERIC;
  v_points_earned INTEGER;
  v_customer_id UUID;
BEGIN
  -- Get points per dollar
  SELECT COALESCE(points_per_dollar, 1)
  INTO v_points_per_dollar
  FROM public.marketplace_loyalty_config
  WHERE store_id = p_store_id;

  IF v_points_per_dollar IS NULL THEN
    v_points_per_dollar := 1;
  END IF;

  -- Calculate points
  v_points_earned := FLOOR(p_order_total * v_points_per_dollar);

  -- Add points to customer
  UPDATE public.marketplace_customers
  SET 
    loyalty_points = COALESCE(loyalty_points, 0) + v_points_earned,
    lifetime_points = COALESCE(lifetime_points, 0) + v_points_earned,
    updated_at = now()
  WHERE store_id = p_store_id
  AND email = lower(p_customer_email)
  RETURNING id INTO v_customer_id;

  IF v_customer_id IS NULL THEN
    RETURN 0;
  END IF;

  RETURN v_points_earned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.marketplace_loyalty_config IS 'Store-specific loyalty program configuration';
COMMENT ON TABLE public.marketplace_loyalty_rewards IS 'Reward catalog for loyalty point redemption';

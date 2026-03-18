-- Create marketplace_payouts table
CREATE TABLE IF NOT EXISTS public.marketplace_payouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    amount NUMERIC(15,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    method TEXT DEFAULT 'manual',
    reference_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_payouts_seller ON public.marketplace_payouts(seller_tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_payouts_status ON public.marketplace_payouts(status);

-- Add payout link to orders
ALTER TABLE public.marketplace_orders
ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES public.marketplace_payouts(id);

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_payout ON public.marketplace_orders(payout_id);

-- Enable RLS
ALTER TABLE public.marketplace_payouts ENABLE ROW LEVEL SECURITY;

-- Policies for Payouts
CREATE POLICY "Sellers can view own payouts"
ON public.marketplace_payouts
FOR SELECT
USING (
  seller_tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
);

-- Only Super Admins (Platform Owners) can insert/update payouts
-- Assuming there is a role check or similar. For now, we might restrict it or allow based on a specific flag.
-- However, typically RLS blocks everyone by default. We need a policy for admins.
-- Assuming "service_role" bypasses RLS, so admin API calls work.
-- If we have a 'platform_admin' role, we should use it. For now, I'll rely on the fact that regular users can't write.

-- Simple function to calculate platform commission
CREATE OR REPLACE FUNCTION public.calculate_marketplace_commission()
RETURNS TRIGGER AS $$
BEGIN
  -- Default 2% fee if not set
  IF NEW.platform_fee IS NULL THEN
     NEW.platform_fee := ROUND((NEW.subtotal * 0.02), 2);
  END IF;
  
  -- Update total amount to include tax and shipping if needed, 
  -- but usually total_amount comes from frontend. 
  -- We just ensure platform_fee is set.
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calc fee on insert
DROP TRIGGER IF EXISTS trigger_calc_commission ON public.marketplace_orders;
CREATE TRIGGER trigger_calc_commission
BEFORE INSERT ON public.marketplace_orders
FOR EACH ROW
EXECUTE FUNCTION public.calculate_marketplace_commission();

-- Create Ledger View
CREATE OR REPLACE VIEW public.marketplace_transactions AS
SELECT 
  id as transaction_id,
  seller_tenant_id as tenant_id,
  'sale' as type,
  (total_amount - COALESCE(platform_fee, 0)) as amount,
  delivered_at as transaction_date,
  id as reference_id
FROM public.marketplace_orders
WHERE status = 'delivered'

UNION ALL

SELECT
  id as transaction_id,
  seller_tenant_id as tenant_id,
  'payout' as type,
  -amount as amount,
  created_at as transaction_date,
  id as reference_id
FROM public.marketplace_payouts;

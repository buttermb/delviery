-- ============================================================================
-- CREDIT SYSTEM MIGRATION
-- ============================================================================

-- ============================================================================
-- TENANT_CREDITS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tenant_credits (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 500 CHECK (balance >= 0), -- Give 500 free credits start
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_credits_tenant_id ON public.tenant_credits(tenant_id);

-- RLS
ALTER TABLE public.tenant_credits ENABLE ROW LEVEL SECURITY;

-- Tenants can view their own credits
CREATE POLICY "Tenants view own credits"
  ON public.tenant_credits FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

-- Super admins can view/manage all credits
CREATE POLICY "Super admins manage all credits"
  ON public.tenant_credits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admin_users 
      WHERE id = auth.uid()::text::uuid
    )
  );


-- ============================================================================
-- CREDIT DEDUCTION TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION deduct_credits_on_order()
RETURNS TRIGGER AS $$
DECLARE
  required_credits INTEGER := 100;
  current_balance INTEGER;
BEGIN
  -- 1. Check/Get Balance for Seller
  SELECT balance INTO current_balance 
  FROM public.tenant_credits 
  WHERE tenant_id = NEW.seller_tenant_id;
  
  -- If no record exists, create one with default (should be handled by tenant creation trigger generally, but fallback here)
  IF current_balance IS NULL THEN
     INSERT INTO public.tenant_credits (tenant_id, balance) 
     VALUES (NEW.seller_tenant_id, 500) -- Default starting credits
     RETURNING balance INTO current_balance;
  END IF;

  -- 2. Check sufficiency
  IF current_balance < required_credits THEN
    RAISE EXCEPTION 'Store has insufficient credits to accept new orders. Please contact the seller.';
  END IF;

  -- 3. Deduct Credits
  UPDATE public.tenant_credits 
  SET balance = balance - required_credits, 
      updated_at = NOW() 
  WHERE tenant_id = NEW.seller_tenant_id;
  
  -- 4. Log Transaction (Optional: Insert into platform_transactions or credit_history if exists)
  -- For now, we rely on the deduction.
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on INSERT of new order
DROP TRIGGER IF EXISTS check_credits_before_order_trigger ON public.marketplace_orders;
CREATE TRIGGER check_credits_before_order_trigger
  BEFORE INSERT ON public.marketplace_orders
  FOR EACH ROW
  EXECUTE FUNCTION deduct_credits_on_order();

-- Trigger for updated_at on tenant_credits
CREATE TRIGGER update_tenant_credits_updated_at
  BEFORE UPDATE ON public.tenant_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

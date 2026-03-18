-- Add missing onboarding tracking columns to tenants table
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS demo_data_generated BOOLEAN DEFAULT false;

-- Set default values for existing tenants
UPDATE public.tenants 
SET 
  onboarding_completed = COALESCE(onboarding_completed, false),
  demo_data_generated = COALESCE(demo_data_generated, false)
WHERE onboarding_completed IS NULL OR demo_data_generated IS NULL;

-- Add documentation comments
COMMENT ON COLUMN public.tenants.onboarding_completed IS 'Whether tenant has completed initial onboarding';
COMMENT ON COLUMN public.tenants.onboarding_completed_at IS 'Timestamp when onboarding was completed';
COMMENT ON COLUMN public.tenants.demo_data_generated IS 'Whether demo data has been generated for this tenant';

-- Create commission_transactions table for tracking tenant commissions
CREATE TABLE IF NOT EXISTS public.commission_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_payment_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  commission_rate DECIMAL(5,4) DEFAULT 0.02,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'paid', 'cancelled')),
  processed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_commission_transactions_tenant ON public.commission_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_transactions_status ON public.commission_transactions(status);
CREATE INDEX IF NOT EXISTS idx_commission_transactions_created ON public.commission_transactions(created_at DESC);

-- Enable RLS on commission_transactions
ALTER TABLE public.commission_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for commission_transactions
CREATE POLICY "Tenants can view own commission transactions"
  ON public.commission_transactions
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT id FROM public.tenants WHERE id = tenant_id
    )
  );

CREATE POLICY "Admins can view all commission transactions"
  ON public.commission_transactions
  FOR SELECT
  USING (is_admin_user());

CREATE POLICY "System can insert commission transactions"
  ON public.commission_transactions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update commission transactions"
  ON public.commission_transactions
  FOR UPDATE
  USING (is_admin_user());

COMMENT ON TABLE public.commission_transactions IS 'Tracks commission transactions for tenant payments';
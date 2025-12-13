-- Create tenant payment settings table
CREATE TABLE IF NOT EXISTS public.tenant_payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Payment method toggles
  accept_cash BOOLEAN DEFAULT true,
  accept_zelle BOOLEAN DEFAULT false,
  accept_cashapp BOOLEAN DEFAULT false,
  accept_bitcoin BOOLEAN DEFAULT false,
  accept_lightning BOOLEAN DEFAULT false,
  accept_ethereum BOOLEAN DEFAULT false,
  accept_usdt BOOLEAN DEFAULT false,
  
  -- Payment details
  zelle_username TEXT,
  zelle_phone TEXT,
  cashapp_username TEXT,
  bitcoin_address TEXT,
  lightning_address TEXT,
  ethereum_address TEXT,
  usdt_address TEXT,
  
  -- Custom instructions
  cash_instructions TEXT,
  zelle_instructions TEXT,
  cashapp_instructions TEXT,
  crypto_instructions TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id)
);

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_tenant_payment_settings_tenant_id ON public.tenant_payment_settings(tenant_id);

-- Enable RLS
ALTER TABLE public.tenant_payment_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant isolation using safe helper functions
CREATE POLICY "Tenants can view their own payment settings"
  ON public.tenant_payment_settings FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids_safe(auth.uid())));

CREATE POLICY "Tenant admins can update their payment settings"
  ON public.tenant_payment_settings FOR UPDATE
  USING (public.is_tenant_admin_safe(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can insert payment settings"
  ON public.tenant_payment_settings FOR INSERT
  WITH CHECK (public.is_tenant_admin_safe(auth.uid(), tenant_id));

-- Public read for customer-facing checkout (customers need to see payment options)
CREATE POLICY "Public can read payment settings for checkout"
  ON public.tenant_payment_settings FOR SELECT
  USING (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_tenant_payment_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS update_tenant_payment_settings_updated_at_trigger ON public.tenant_payment_settings;
CREATE TRIGGER update_tenant_payment_settings_updated_at_trigger
  BEFORE UPDATE ON public.tenant_payment_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tenant_payment_settings_updated_at();

-- Initialize default settings for all existing tenants
INSERT INTO public.tenant_payment_settings (tenant_id, accept_cash)
SELECT id, true FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Add comment
COMMENT ON TABLE public.tenant_payment_settings IS 'Payment method settings for each tenant (cash, Zelle, CashApp, crypto)';
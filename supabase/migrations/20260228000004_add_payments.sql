-- Create payments table for tracking order payments
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid,
  customer_id uuid,
  amount decimal NOT NULL,
  method text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  transaction_id text,
  processing_fee decimal DEFAULT 0,
  notes text,
  processed_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS (REQUIRED)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS: Tenant users can view their tenant's payments
CREATE POLICY "Tenant users can view payments"
  ON public.payments
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- RLS: Tenant users can insert payments for their tenant
CREATE POLICY "Tenant users can create payments"
  ON public.payments
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- RLS: Tenant users can update their tenant's payments
CREATE POLICY "Tenant users can update payments"
  ON public.payments
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- RLS: Tenant users can delete their tenant's payments
CREATE POLICY "Tenant users can delete payments"
  ON public.payments
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_payments_tenant ON public.payments(tenant_id);
CREATE INDEX idx_payments_order ON public.payments(order_id);
CREATE INDEX idx_payments_customer ON public.payments(customer_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_created ON public.payments(created_at DESC);
CREATE INDEX idx_payments_transaction ON public.payments(transaction_id);

-- Updated timestamp trigger
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

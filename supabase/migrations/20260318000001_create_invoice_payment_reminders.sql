-- Create invoice_payment_reminders table for tracking sent and scheduled payment reminders
CREATE TABLE IF NOT EXISTS public.invoice_payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('gentle', 'firm', 'final', 'email', 'sms', 'both')),
  message TEXT,
  sent_to TEXT,
  days_before_due INTEGER DEFAULT 0,
  message_template TEXT,
  auto_send BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'scheduled', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoice_payment_reminders_tenant_id ON public.invoice_payment_reminders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payment_reminders_invoice_id ON public.invoice_payment_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payment_reminders_status ON public.invoice_payment_reminders(status);

-- Enable RLS
ALTER TABLE public.invoice_payment_reminders ENABLE ROW LEVEL SECURITY;

-- Tenant users can view reminders for their tenant
CREATE POLICY invoice_payment_reminders_select_tenant
  ON public.invoice_payment_reminders
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_users.tenant_id = invoice_payment_reminders.tenant_id
      AND tenant_users.user_id = auth.uid()
  ));

-- Tenant users can insert reminders for their tenant
CREATE POLICY invoice_payment_reminders_insert_tenant
  ON public.invoice_payment_reminders
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_users.tenant_id = invoice_payment_reminders.tenant_id
      AND tenant_users.user_id = auth.uid()
  ));

-- Tenant users can update reminders for their tenant
CREATE POLICY invoice_payment_reminders_update_tenant
  ON public.invoice_payment_reminders
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_users.tenant_id = invoice_payment_reminders.tenant_id
      AND tenant_users.user_id = auth.uid()
  ));

-- Tenant users can delete reminders for their tenant
CREATE POLICY invoice_payment_reminders_delete_tenant
  ON public.invoice_payment_reminders
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_users.tenant_id = invoice_payment_reminders.tenant_id
      AND tenant_users.user_id = auth.uid()
  ));

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_invoice_payment_reminders_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_invoice_payment_reminders_updated_at
  BEFORE UPDATE ON public.invoice_payment_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_invoice_payment_reminders_updated_at();

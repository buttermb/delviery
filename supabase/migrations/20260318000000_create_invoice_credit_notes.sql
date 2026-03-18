-- Create invoice_credit_notes table for the InvoiceCreditNoteSystem
-- Tracks credit notes issued against CRM invoices for returns, adjustments, overpayments

CREATE TABLE IF NOT EXISTS public.invoice_credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.crm_invoices(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  credit_note_number text NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL DEFAULT 'adjustment' CHECK (reason IN ('return', 'discount', 'overpayment', 'adjustment', 'other')),
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'applied')),
  issued_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_credit_note_number_per_tenant UNIQUE(tenant_id, credit_note_number)
);

-- Enable RLS
ALTER TABLE public.invoice_credit_notes ENABLE ROW LEVEL SECURITY;

-- RLS policy: tenant isolation via profiles join
CREATE POLICY "tenant_isolation" ON public.invoice_credit_notes
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Indexes for performance
CREATE INDEX idx_invoice_credit_notes_tenant ON public.invoice_credit_notes(tenant_id);
CREATE INDEX idx_invoice_credit_notes_invoice ON public.invoice_credit_notes(invoice_id);
CREATE INDEX idx_invoice_credit_notes_client ON public.invoice_credit_notes(client_id);
CREATE INDEX idx_invoice_credit_notes_status ON public.invoice_credit_notes(tenant_id, status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_invoice_credit_notes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoice_credit_notes_updated_at
  BEFORE UPDATE ON public.invoice_credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_invoice_credit_notes_updated_at();

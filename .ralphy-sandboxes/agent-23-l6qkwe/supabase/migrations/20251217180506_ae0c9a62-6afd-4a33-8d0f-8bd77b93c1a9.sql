-- Create recurring_invoice_schedules table
CREATE TABLE IF NOT EXISTS public.recurring_invoice_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.invoice_templates(id),
  name TEXT NOT NULL,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  next_run_date DATE NOT NULL,
  last_run_date DATE,
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 28),
  auto_send_email BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for efficient scheduling queries
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_tenant ON public.recurring_invoice_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_next_run ON public.recurring_invoice_schedules(next_run_date) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.recurring_invoice_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant members can view their schedules"
  ON public.recurring_invoice_schedules FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

CREATE POLICY "Tenant members can insert schedules"
  ON public.recurring_invoice_schedules FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

CREATE POLICY "Tenant members can update their schedules"
  ON public.recurring_invoice_schedules FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

CREATE POLICY "Tenant members can delete their schedules"
  ON public.recurring_invoice_schedules FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

-- Add is_recurring flag to crm_invoices
ALTER TABLE public.crm_invoices 
ADD COLUMN IF NOT EXISTS recurring_schedule_id UUID REFERENCES public.recurring_invoice_schedules(id),
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;

-- Update timestamp trigger
CREATE TRIGGER update_recurring_schedules_updated_at
  BEFORE UPDATE ON public.recurring_invoice_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
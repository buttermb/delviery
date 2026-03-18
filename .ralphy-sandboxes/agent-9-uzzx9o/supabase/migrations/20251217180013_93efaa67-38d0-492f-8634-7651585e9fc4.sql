-- Create invoice_templates table for customizable invoice designs
CREATE TABLE IF NOT EXISTS public.invoice_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL DEFAULT '{
    "colors": {
      "primary": "#10b981",
      "secondary": "#6b7280",
      "accent": "#3b82f6"
    },
    "layout": {
      "logoPosition": "left",
      "showFooter": true,
      "compactMode": false
    },
    "content": {
      "footerText": "Thank you for your business!",
      "paymentInstructions": ""
    }
  }'::jsonb,
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for tenant lookup
CREATE INDEX IF NOT EXISTS idx_invoice_templates_tenant ON public.invoice_templates(tenant_id);

-- Enable RLS
ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies using auth.uid()
CREATE POLICY "Tenant members can view their templates"
  ON public.invoice_templates FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

CREATE POLICY "Tenant members can insert templates"
  ON public.invoice_templates FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

CREATE POLICY "Tenant members can update their templates"
  ON public.invoice_templates FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

CREATE POLICY "Tenant members can delete their templates"
  ON public.invoice_templates FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())) AND is_system = false);

-- Add template_id to crm_invoices if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'crm_invoices' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE public.crm_invoices ADD COLUMN template_id UUID REFERENCES public.invoice_templates(id);
  END IF;
END $$;

-- Update timestamp trigger (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_invoice_templates_updated_at'
  ) THEN
    CREATE TRIGGER update_invoice_templates_updated_at
      BEFORE UPDATE ON public.invoice_templates
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
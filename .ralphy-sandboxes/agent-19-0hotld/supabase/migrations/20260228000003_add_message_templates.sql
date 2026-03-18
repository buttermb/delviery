-- Migration: Create message_templates table for tenant messaging templates
-- Epic: floraiq-x79 - Message Templates

-- Create message_templates table
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  category TEXT,
  usage_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_message_templates_tenant_id ON public.message_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_channel ON public.message_templates(tenant_id, channel);
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON public.message_templates(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_message_templates_is_active ON public.message_templates(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant members can view message templates in their tenant
CREATE POLICY "Tenant members can view message templates"
  ON public.message_templates
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- RLS Policy: Tenant admins can insert message templates
CREATE POLICY "Tenant admins can insert message templates"
  ON public.message_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = message_templates.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role IN ('admin', 'owner')
    )
  );

-- RLS Policy: Tenant admins can update message templates
CREATE POLICY "Tenant admins can update message templates"
  ON public.message_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = message_templates.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role IN ('admin', 'owner')
    )
  );

-- RLS Policy: Tenant admins can delete message templates
CREATE POLICY "Tenant admins can delete message templates"
  ON public.message_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = message_templates.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role IN ('admin', 'owner')
    )
  );

-- Add comments
COMMENT ON TABLE public.message_templates IS 'Tenant-level message templates for multi-channel communication';
COMMENT ON COLUMN public.message_templates.channel IS 'Communication channel: email, sms, push, telegram, etc.';
COMMENT ON COLUMN public.message_templates.subject IS 'Message subject line (primarily for email)';
COMMENT ON COLUMN public.message_templates.body IS 'Template body content with variable placeholders';
COMMENT ON COLUMN public.message_templates.variables IS 'JSON array of variable definitions available in this template';
COMMENT ON COLUMN public.message_templates.category IS 'Template category for organization (e.g., orders, marketing, notifications)';
COMMENT ON COLUMN public.message_templates.usage_count IS 'Number of times this template has been used';

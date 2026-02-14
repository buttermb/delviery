-- Create webhook_logs table for tracking webhook delivery attempts
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, success, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant_id ON public.webhook_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON public.webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON public.webhook_logs(status);

-- Enable RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for webhook_logs
CREATE POLICY "Tenants can view own webhook_logs"
  ON public.webhook_logs FOR SELECT
  USING (
    tenant_id IN (
      SELECT a.tenant_id
      FROM public.profiles p
      JOIN public.accounts a ON p.account_id = a.id
      WHERE p.user_id = auth.uid()
    )
  );

-- System can insert webhook_logs (via edge functions)
CREATE POLICY "System can insert webhook_logs"
  ON public.webhook_logs FOR INSERT
  WITH CHECK (true);

-- Trigger for tenant_id auto-assignment
CREATE TRIGGER auto_assign_webhook_logs_tenant
  BEFORE INSERT ON public.webhook_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_tenant_id();

-- Add integration_id to webhooks table to link webhooks to integrations
ALTER TABLE public.webhooks
ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES public.custom_integrations(id) ON DELETE SET NULL;

-- Create index for integration_id
CREATE INDEX IF NOT EXISTS idx_webhooks_integration_id ON public.webhooks(integration_id);

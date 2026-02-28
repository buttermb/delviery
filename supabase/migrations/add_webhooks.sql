-- Migration: add_webhooks
-- Adds missing columns to webhooks table and creates webhook_deliveries table

-- Add missing columns to existing webhooks table
ALTER TABLE public.webhooks
ADD COLUMN IF NOT EXISTS event_type TEXT,
ADD COLUMN IF NOT EXISTS headers JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;

-- Create webhook_deliveries table
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  response_code INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON public.webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_tenant_id ON public.webhook_deliveries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON public.webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON public.webhook_deliveries(created_at DESC);

-- Enable RLS on webhook_deliveries
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for webhook_deliveries (tenant isolation)
CREATE POLICY "Tenants can view own webhook_deliveries"
  ON public.webhook_deliveries FOR SELECT
  USING (
    tenant_id IN (
      SELECT a.tenant_id
      FROM public.profiles p
      JOIN public.accounts a ON p.account_id = a.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can insert own webhook_deliveries"
  ON public.webhook_deliveries FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT a.tenant_id
      FROM public.profiles p
      JOIN public.accounts a ON p.account_id = a.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can update own webhook_deliveries"
  ON public.webhook_deliveries FOR UPDATE
  USING (
    tenant_id IN (
      SELECT a.tenant_id
      FROM public.profiles p
      JOIN public.accounts a ON p.account_id = a.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can delete own webhook_deliveries"
  ON public.webhook_deliveries FOR DELETE
  USING (
    tenant_id IN (
      SELECT a.tenant_id
      FROM public.profiles p
      JOIN public.accounts a ON p.account_id = a.id
      WHERE p.user_id = auth.uid()
    )
  );

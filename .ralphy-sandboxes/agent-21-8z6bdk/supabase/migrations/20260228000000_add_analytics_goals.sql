-- Migration: Create analytics_goals table for tracking business metric goals
-- Date: 2026-02-28
-- Description: Stores analytics goals with target/current values and period tracking per tenant

-- Create analytics_goals table
CREATE TABLE IF NOT EXISTS public.analytics_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  target_value DECIMAL NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  current_value DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_analytics_goals_tenant_id ON public.analytics_goals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analytics_goals_created_at ON public.analytics_goals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_goals_metric_name ON public.analytics_goals(tenant_id, metric_name);
CREATE INDEX IF NOT EXISTS idx_analytics_goals_period ON public.analytics_goals(tenant_id, period_type, period_start, period_end);

-- Enable Row Level Security
ALTER TABLE public.analytics_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant members can view analytics goals
CREATE POLICY "Tenant members can view analytics goals"
  ON public.analytics_goals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = analytics_goals.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  );

-- RLS Policy: Tenant admins can insert analytics goals
CREATE POLICY "Tenant admins can insert analytics goals"
  ON public.analytics_goals
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = analytics_goals.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('admin', 'owner')
    )
  );

-- RLS Policy: Tenant admins can update analytics goals
CREATE POLICY "Tenant admins can update analytics goals"
  ON public.analytics_goals
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = analytics_goals.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = analytics_goals.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('admin', 'owner')
    )
  );

-- RLS Policy: Tenant admins can delete analytics goals
CREATE POLICY "Tenant admins can delete analytics goals"
  ON public.analytics_goals
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = analytics_goals.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('admin', 'owner')
    )
  );

-- Add comment
COMMENT ON TABLE public.analytics_goals IS 'Stores business metric goals with target/current values and period tracking per tenant';

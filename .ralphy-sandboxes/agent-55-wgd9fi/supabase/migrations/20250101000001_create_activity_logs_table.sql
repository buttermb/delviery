-- Migration: Create activity_logs table for user activity tracking
-- Phase 4: Create Missing Tables & Logging

-- Create activity_logs table if it doesn't exist with the correct structure
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_id ON public.activity_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON public.activity_logs(resource, resource_id);

-- Enable Row Level Security
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own activity logs
CREATE POLICY "Users can view own activity logs"
  ON public.activity_logs
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = activity_logs.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('admin', 'owner')
    )
  );

-- RLS Policy: System can insert activity logs
CREATE POLICY "System can insert activity logs"
  ON public.activity_logs
  FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Tenant admins can view all activity in their tenant
CREATE POLICY "Tenant admins can view tenant activity"
  ON public.activity_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = activity_logs.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('admin', 'owner')
    )
  );

-- Create SQL function to log activity
CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id UUID,
  p_tenant_id UUID,
  p_action TEXT,
  p_resource TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.activity_logs (
    user_id,
    tenant_id,
    action,
    resource,
    resource_id,
    metadata,
    created_at
  )
  VALUES (
    p_user_id,
    p_tenant_id,
    p_action,
    p_resource,
    p_resource_id,
    p_metadata,
    NOW()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.log_activity(UUID, UUID, TEXT, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity(UUID, UUID, TEXT, TEXT, UUID, JSONB) TO service_role;

-- Add comments
COMMENT ON TABLE public.activity_logs IS 'User activity logs for tracking actions across the platform';
COMMENT ON COLUMN public.activity_logs.action IS 'Action performed (e.g., create_order, update_inventory, process_payment)';
COMMENT ON COLUMN public.activity_logs.resource IS 'Resource type (e.g., order, inventory, payment)';
COMMENT ON COLUMN public.activity_logs.metadata IS 'Additional context data as JSON object';


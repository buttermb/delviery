-- Migration: Enhance activity_logs table for unified activity feed
-- Adds category, severity, user_email, and description columns for richer feed display

-- Add category column for filtering (e.g., 'order', 'inventory', 'user', 'system', 'payment', 'settings')
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'system';

-- Add severity for visual distinction (info, warning, error, success)
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info';

-- Add user_email for display without joins
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Add description for human-readable context
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS description TEXT;

-- Add tenant_id if not present (the generated types show account_id, but migration uses tenant_id)
-- This handles the case where the table structure diverged
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Add resource column if not present
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS resource TEXT;

-- Add resource_id column if not present
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS resource_id UUID;

-- Add metadata column if not present
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_activity_logs_category ON public.activity_logs(category);
CREATE INDEX IF NOT EXISTS idx_activity_logs_severity ON public.activity_logs(severity);
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_created
  ON public.activity_logs(tenant_id, created_at DESC);

-- Composite index for common filter patterns
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_category_created
  ON public.activity_logs(tenant_id, category, created_at DESC);

-- Update RLS policies to ensure tenant isolation via tenant_id
-- Drop old policies if they exist (graceful with DO block)
DO $$
BEGIN
  -- Only create policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activity_logs'
    AND policyname = 'Tenant members can view activity logs'
  ) THEN
    CREATE POLICY "Tenant members can view activity logs"
      ON public.activity_logs
      FOR SELECT
      USING (
        tenant_id IN (
          SELECT tu.tenant_id FROM public.tenant_users tu
          WHERE tu.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- Function to log activity with category and severity
CREATE OR REPLACE FUNCTION public.log_unified_activity(
  p_tenant_id UUID,
  p_action TEXT,
  p_category TEXT DEFAULT 'system',
  p_severity TEXT DEFAULT 'info',
  p_resource TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_user_email TEXT;
BEGIN
  -- Get user email from auth
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();

  INSERT INTO public.activity_logs (
    user_id,
    tenant_id,
    action,
    category,
    severity,
    resource,
    resource_id,
    description,
    user_email,
    metadata,
    created_at
  )
  VALUES (
    auth.uid(),
    p_tenant_id,
    p_action,
    p_category,
    p_severity,
    p_resource,
    p_resource_id,
    p_description,
    v_user_email,
    p_metadata,
    NOW()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.log_unified_activity(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_unified_activity(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, JSONB) TO service_role;

-- Add comments
COMMENT ON FUNCTION public.log_unified_activity IS 'Logs activity with category, severity, and auto-resolved user email for the unified activity feed';

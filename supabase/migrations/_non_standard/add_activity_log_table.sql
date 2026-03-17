-- Migration: Create activity_log table for tracking user and system actions
-- Task-010: Activity log table with tenant isolation and proper indexing

-- Create activity_log table
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read activity logs for their tenant
CREATE POLICY "activity_log_tenant_read_policy"
  ON public.activity_log
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can only insert activity logs for their tenant
CREATE POLICY "activity_log_tenant_insert_policy"
  ON public.activity_log
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- RLS Policy: Service role can do anything (for system-level logging)
CREATE POLICY "activity_log_service_role_policy"
  ON public.activity_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Create composite index on tenant_id, entity_type, created_at for efficient querying
CREATE INDEX IF NOT EXISTS idx_activity_log_tenant_entity_created
  ON public.activity_log(tenant_id, entity_type, created_at DESC);

-- Additional indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_activity_log_tenant_id
  ON public.activity_log(tenant_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_entity_id
  ON public.activity_log(entity_id)
  WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id
  ON public.activity_log(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_action
  ON public.activity_log(action);

-- Add table and column comments for documentation
COMMENT ON TABLE public.activity_log IS 'Tracks user and system actions across the platform with tenant isolation';
COMMENT ON COLUMN public.activity_log.id IS 'Unique identifier for the activity log entry';
COMMENT ON COLUMN public.activity_log.tenant_id IS 'Tenant this activity belongs to';
COMMENT ON COLUMN public.activity_log.user_id IS 'User who performed the action (null for system actions)';
COMMENT ON COLUMN public.activity_log.action IS 'Action performed (e.g., created, updated, deleted)';
COMMENT ON COLUMN public.activity_log.entity_type IS 'Type of entity affected (e.g., order, product, customer)';
COMMENT ON COLUMN public.activity_log.entity_id IS 'ID of the specific entity affected';
COMMENT ON COLUMN public.activity_log.metadata IS 'Additional context data as JSON';
COMMENT ON COLUMN public.activity_log.created_at IS 'Timestamp when the activity occurred';

-- Grant permissions
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

-- ============================================================================
-- CREATE CUSTOMER ACTIVITIES TABLE
-- ============================================================================
-- Activity tracking for CRM - inspired by Twenty CRM
-- Tracks all customer interactions: calls, emails, meetings, notes, orders, payments, tasks
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customer_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'note', 'order', 'payment', 'task')),
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_activities_customer_id ON public.customer_activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_activities_tenant_id ON public.customer_activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_activities_activity_type ON public.customer_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_customer_activities_created_at ON public.customer_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_activities_created_by ON public.customer_activities(created_by);

-- Enable RLS
ALTER TABLE public.customer_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant-scoped access
DROP POLICY IF EXISTS "tenant_isolation_customer_activities" ON public.customer_activities;
CREATE POLICY "tenant_isolation_customer_activities"
  ON public.customer_activities
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE tenant_users.user_id = auth.uid()
      AND tenant_users.status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE tenant_users.user_id = auth.uid()
      AND tenant_users.status = 'active'
    )
  );

-- Comments
COMMENT ON TABLE public.customer_activities IS 'Tracks all customer interactions and activities for CRM';
COMMENT ON COLUMN public.customer_activities.activity_type IS 'Type of activity: call, email, meeting, note, order, payment, task';
COMMENT ON COLUMN public.customer_activities.metadata IS 'Additional activity data stored as JSON (e.g., call duration, email subject, meeting location)';


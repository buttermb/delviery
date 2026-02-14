-- Migration: Create notifications table for in-app notification system
-- Supports cross-module notification dispatch (order events, inventory alerts, etc.)

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
  entity_type TEXT,
  entity_id UUID,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
-- Composite index for tenant + user + read status + time ordering (common query pattern)
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user_read_created
  ON public.notifications(tenant_id, user_id, read, created_at DESC);

-- Single column indexes for specific filters
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id
  ON public.notifications(tenant_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_read
  ON public.notifications(read)
  WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON public.notifications(created_at DESC);

-- Index for entity lookups (finding notifications about specific entities)
CREATE INDEX IF NOT EXISTS idx_notifications_entity
  ON public.notifications(entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view notifications for their tenant
-- Either targeted at them specifically (user_id matches) or broadcast to all (user_id is null)
CREATE POLICY "notifications_tenant_read_policy"
  ON public.notifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = notifications.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
    AND (notifications.user_id IS NULL OR notifications.user_id = auth.uid())
  );

-- RLS Policy: Users can insert notifications for their tenant
CREATE POLICY "notifications_tenant_insert_policy"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = notifications.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can update (mark as read) their own notifications
CREATE POLICY "notifications_tenant_update_policy"
  ON public.notifications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = notifications.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
    AND (notifications.user_id IS NULL OR notifications.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = notifications.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can delete their own notifications
CREATE POLICY "notifications_tenant_delete_policy"
  ON public.notifications
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = notifications.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
    AND (notifications.user_id IS NULL OR notifications.user_id = auth.uid())
  );

-- RLS Policy: Service role can do anything (for system-level notifications)
CREATE POLICY "notifications_service_role_policy"
  ON public.notifications
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- Add comments for documentation
COMMENT ON TABLE public.notifications IS 'In-app notifications for users across the platform';
COMMENT ON COLUMN public.notifications.tenant_id IS 'Tenant this notification belongs to';
COMMENT ON COLUMN public.notifications.user_id IS 'Target user (null = broadcast to all tenant users)';
COMMENT ON COLUMN public.notifications.title IS 'Notification title/headline';
COMMENT ON COLUMN public.notifications.message IS 'Detailed notification message';
COMMENT ON COLUMN public.notifications.type IS 'Notification type: info, warning, error, success';
COMMENT ON COLUMN public.notifications.entity_type IS 'Related entity type (order, product, inventory, etc.)';
COMMENT ON COLUMN public.notifications.entity_id IS 'Related entity UUID for deep linking';
COMMENT ON COLUMN public.notifications.read IS 'Whether the notification has been read';
COMMENT ON COLUMN public.notifications.created_at IS 'Timestamp when notification was created';

-- Enable realtime for this table (for live notification updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

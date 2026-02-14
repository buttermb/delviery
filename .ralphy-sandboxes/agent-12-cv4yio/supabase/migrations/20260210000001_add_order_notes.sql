-- Migration: Create order_notes table for order comments with @mentions
-- Supports internal team communication on orders with user mentions

-- Create order_notes table
CREATE TABLE IF NOT EXISTS public.order_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentioned_user_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_order_notes_tenant_id ON public.order_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_notes_order_id ON public.order_notes(order_id);
CREATE INDEX IF NOT EXISTS idx_order_notes_user_id ON public.order_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_order_notes_order_created ON public.order_notes(order_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view notes for orders in their tenant
CREATE POLICY "Users can view order notes in their tenant"
  ON public.order_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = order_notes.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert notes for orders in their tenant
CREATE POLICY "Users can insert order notes in their tenant"
  ON public.order_notes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = order_notes.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can update their own notes
CREATE POLICY "Users can update their own order notes"
  ON public.order_notes
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = order_notes.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can delete their own notes
CREATE POLICY "Users can delete their own order notes"
  ON public.order_notes
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = order_notes.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  );

-- RLS Policy: Tenant admins can manage all notes in their tenant
CREATE POLICY "Tenant admins can manage all order notes"
  ON public.order_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = order_notes.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('admin', 'owner')
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.order_notes IS 'Internal team notes on orders with @mention support';
COMMENT ON COLUMN public.order_notes.content IS 'The note content, may include @mentions';
COMMENT ON COLUMN public.order_notes.mentioned_user_ids IS 'Array of user IDs that were mentioned in this note';

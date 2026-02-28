-- Migration: Create messages table for tenant messaging
-- Epic: floraiq-x79 - Messages

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'customer', 'system')),
  sender_id UUID,
  recipient_type TEXT NOT NULL,
  recipient_id UUID,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'in_app')),
  subject TEXT,
  body TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'delivered', 'read', 'failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON public.messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(tenant_id, sender_type, sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages(tenant_id, recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON public.messages(tenant_id, channel);
CREATE INDEX IF NOT EXISTS idx_messages_status ON public.messages(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_reference ON public.messages(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant members can view messages in their tenant
CREATE POLICY "Tenant members can view messages"
  ON public.messages
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- RLS Policy: Tenant admins can insert messages
CREATE POLICY "Tenant admins can insert messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = messages.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role IN ('admin', 'owner')
    )
  );

-- RLS Policy: Tenant admins can update messages
CREATE POLICY "Tenant admins can update messages"
  ON public.messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = messages.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role IN ('admin', 'owner')
    )
  );

-- RLS Policy: Tenant admins can delete messages
CREATE POLICY "Tenant admins can delete messages"
  ON public.messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = messages.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role IN ('admin', 'owner')
    )
  );

-- Add comments
COMMENT ON TABLE public.messages IS 'Tenant-level messages for multi-channel communication (sms, email, in-app)';
COMMENT ON COLUMN public.messages.sender_type IS 'Type of sender: admin, customer, or system';
COMMENT ON COLUMN public.messages.sender_id IS 'UUID of the sender (user or system identifier)';
COMMENT ON COLUMN public.messages.recipient_type IS 'Type of recipient (e.g., customer, admin, group)';
COMMENT ON COLUMN public.messages.recipient_id IS 'UUID of the recipient';
COMMENT ON COLUMN public.messages.channel IS 'Communication channel: sms, email, or in_app';
COMMENT ON COLUMN public.messages.subject IS 'Message subject line (primarily for email)';
COMMENT ON COLUMN public.messages.body IS 'Message body content';
COMMENT ON COLUMN public.messages.reference_type IS 'Type of related entity (e.g., order, invoice, ticket)';
COMMENT ON COLUMN public.messages.reference_id IS 'UUID of the related entity';
COMMENT ON COLUMN public.messages.status IS 'Message status: draft, sent, delivered, read, or failed';
COMMENT ON COLUMN public.messages.sent_at IS 'Timestamp when the message was sent';

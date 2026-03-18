-- Create marketplace_messages table
CREATE TABLE IF NOT EXISTS public.marketplace_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    receiver_tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    listing_id UUID REFERENCES public.marketplace_listings(id),
    order_id UUID REFERENCES public.marketplace_orders(id),
    subject TEXT,
    message_text TEXT NOT NULL,
    message_encrypted BOOLEAN DEFAULT false,
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_sender ON public.marketplace_messages(sender_tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_receiver ON public.marketplace_messages(receiver_tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_order ON public.marketplace_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_listing ON public.marketplace_messages(listing_id);

-- Enable RLS
ALTER TABLE public.marketplace_messages ENABLE ROW LEVEL SECURITY;

-- Policies

-- View: Sender or Receiver can view
CREATE POLICY "Users can view messages for their tenant"
ON public.marketplace_messages
FOR SELECT
USING (
  sender_tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
  OR
  receiver_tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
);

-- Insert: Can only send AS your tenant
CREATE POLICY "Users can send messages as their tenant"
ON public.marketplace_messages
FOR INSERT
WITH CHECK (
  sender_tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
);

-- Update: Receiver can mark as read
CREATE POLICY "Receivers can update message status"
ON public.marketplace_messages
FOR UPDATE
USING (
  receiver_tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_messages;

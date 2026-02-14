-- ============================================================================
-- CREATE CUSTOMER COMMUNICATIONS TABLE
-- ============================================================================
-- Communication history tracking - inspired by Chatwoot
-- Tracks all email and SMS communications with customers
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customer_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_communications_customer_id ON public.customer_communications(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_communications_tenant_id ON public.customer_communications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_communications_type ON public.customer_communications(type);
CREATE INDEX IF NOT EXISTS idx_customer_communications_direction ON public.customer_communications(direction);
CREATE INDEX IF NOT EXISTS idx_customer_communications_sent_at ON public.customer_communications(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_communications_status ON public.customer_communications(status);

-- Enable RLS
ALTER TABLE public.customer_communications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant-scoped access
DROP POLICY IF EXISTS "tenant_isolation_customer_communications" ON public.customer_communications;
CREATE POLICY "tenant_isolation_customer_communications"
  ON public.customer_communications
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
COMMENT ON TABLE public.customer_communications IS 'Tracks all email and SMS communications with customers';
COMMENT ON COLUMN public.customer_communications.type IS 'Communication type: email or sms';
COMMENT ON COLUMN public.customer_communications.direction IS 'Communication direction: inbound (from customer) or outbound (to customer)';
COMMENT ON COLUMN public.customer_communications.metadata IS 'Additional communication data (e.g., email headers, SMS gateway info, attachments)';


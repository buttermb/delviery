-- Message History Table
-- Stores all SMS and other messages sent to customers

CREATE TABLE IF NOT EXISTS message_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  account_id UUID,
  customer_id UUID,
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  method TEXT NOT NULL DEFAULT 'sms' CHECK (method IN ('sms', 'email', 'push')),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'pending')),
  external_id TEXT, -- Twilio message SID or other provider ID
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_message_history_tenant ON message_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_history_account ON message_history(account_id);
CREATE INDEX IF NOT EXISTS idx_message_history_customer ON message_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_message_history_phone ON message_history(phone_number);
CREATE INDEX IF NOT EXISTS idx_message_history_created ON message_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_history_external ON message_history(external_id);

-- Enable RLS
ALTER TABLE message_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view messages for their tenant"
  ON message_history FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
    OR account_id IN (
      SELECT account_id FROM account_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages for their tenant"
  ON message_history FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
    OR account_id IN (
      SELECT account_id FROM account_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages for their tenant"
  ON message_history FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
    OR account_id IN (
      SELECT account_id FROM account_users WHERE user_id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE message_history IS 'Stores all SMS and other messages sent/received to customers';
COMMENT ON COLUMN message_history.external_id IS 'External provider message ID (e.g., Twilio SID)';
COMMENT ON COLUMN message_history.direction IS 'Direction of message: inbound (from customer) or outbound (to customer)';


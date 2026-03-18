-- Real-time Messaging System Migration
-- Vendor-customer chat tied to orders with Supabase realtime

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES marketplace_orders(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES profiles(id),
  vendor_id UUID REFERENCES profiles(id),
  
  -- Metadata
  customer_name TEXT,
  order_number TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'closed')),
  
  -- Timestamps
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'vendor', 'system')),
  sender_name TEXT,
  
  -- Message content
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'order_update')),
  
  -- Status
  read_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_order ON conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_vendor ON conversations(vendor_id);
CREATE INDEX IF NOT EXISTS idx_conversations_store ON conversations(store_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, read_at) WHERE read_at IS NULL;

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations

-- Customers: View their own conversations
CREATE POLICY "Customers view own conversations"
  ON conversations FOR SELECT
  USING (customer_id = auth.uid());

-- Vendors: View conversations in their tenant
CREATE POLICY "Vendors view tenant conversations"
  ON conversations FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users 
      WHERE user_id = auth.uid()
    )
  );

-- Customers: Create conversations
CREATE POLICY "Customers create conversations"
  ON conversations FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- Vendors: Create conversations for their orders
CREATE POLICY "Vendors create conversations"
  ON conversations FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users 
      WHERE user_id = auth.uid()
    )
  );

-- Update conversations (for status changes)
CREATE POLICY "Users update their conversations"
  ON conversations FOR UPDATE
  USING (
    customer_id = auth.uid() OR
    tenant_id IN (
      SELECT tenant_id FROM tenant_users 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for messages

-- Users: View messages in their conversations
CREATE POLICY "Users view conversation messages"
  ON messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations 
      WHERE customer_id = auth.uid() 
         OR tenant_id IN (
           SELECT tenant_id FROM tenant_users 
           WHERE user_id = auth.uid()
         )
    )
  );

-- Users: Send messages in their conversations
CREATE POLICY "Users send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (
      SELECT id FROM conversations 
      WHERE customer_id = auth.uid() 
         OR tenant_id IN (
           SELECT tenant_id FROM tenant_users 
           WHERE user_id = auth.uid()
         )
    )
  );

-- Users: Update their sent messages (mark as read)
CREATE POLICY "Users update messages"
  ON messages FOR UPDATE
  USING (
    conversation_id IN (
      SELECT id FROM conversations 
      WHERE customer_id = auth.uid() 
         OR tenant_id IN (
           SELECT tenant_id FROM tenant_users 
           WHERE user_id = auth.uid()
         )
    )
  );

-- Function to update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message_at = NEW.created_at,
    updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_message_at
CREATE TRIGGER update_conversation_timestamp
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- Function to get unread message count
CREATE OR REPLACE FUNCTION get_unread_message_count(
  p_user_id UUID,
  p_conversation_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM messages m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE m.read_at IS NULL
    AND m.sender_id != p_user_id
    AND (
      p_conversation_id IS NULL OR m.conversation_id = p_conversation_id
    )
    AND (
      c.customer_id = p_user_id OR
      c.tenant_id IN (
        SELECT tenant_id FROM tenant_users 
        WHERE user_id = p_user_id
      )
    );
$$ LANGUAGE SQL STABLE;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_read(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE messages
  SET read_at = now()
  WHERE conversation_id = p_conversation_id
    AND sender_id != p_user_id
    AND read_at IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

COMMENT ON TABLE conversations IS 'Real-time conversations between vendors and customers';
COMMENT ON TABLE messages IS 'Individual messages within conversations';
COMMENT ON FUNCTION get_unread_message_count IS 'Get count of unread messages for a user';
COMMENT ON FUNCTION mark_messages_read IS 'Mark all messages in a conversation as read';

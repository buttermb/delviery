-- ============================================================================
-- Chat & Review System Tables
-- ============================================================================

-- Conversations table for vendor-customer messaging
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.marketplace_stores(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  order_number TEXT,
  customer_id UUID,
  customer_name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'vendor', 'system')),
  sender_name TEXT,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'order_update')),
  read_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Product reviews table
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.marketplace_stores(id) ON DELETE SET NULL,
  product_id UUID NOT NULL,
  customer_id UUID,
  customer_name TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT NOT NULL,
  is_verified_purchase BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Review responses table
CREATE TABLE IF NOT EXISTS public.review_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL,
  responder_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON public.conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_order_id ON public.conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_product_reviews_tenant_id ON public.product_reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_status ON public.product_reviews(status);
CREATE INDEX IF NOT EXISTS idx_review_responses_review_id ON public.review_responses(review_id);

-- ============================================================================
-- Enable RLS
-- ============================================================================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_responses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Conversations: Tenant members can access their conversations
DROP POLICY IF EXISTS "Tenant members can view conversations" ON public.conversations;
CREATE POLICY "Tenant members can view conversations"
  ON public.conversations FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

DROP POLICY IF EXISTS "Tenant members can create conversations" ON public.conversations;
CREATE POLICY "Tenant members can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

DROP POLICY IF EXISTS "Tenant members can update conversations" ON public.conversations;
CREATE POLICY "Tenant members can update conversations"
  ON public.conversations FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

-- Messages: Users can access messages in their conversations
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  USING (conversation_id IN (
    SELECT id FROM public.conversations 
    WHERE tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (conversation_id IN (
    SELECT id FROM public.conversations 
    WHERE tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid()))
  ));

-- Product Reviews: Public read for approved, authenticated write
DROP POLICY IF EXISTS "Anyone can view approved reviews" ON public.product_reviews;
CREATE POLICY "Anyone can view approved reviews"
  ON public.product_reviews FOR SELECT
  USING (status = 'approved' OR tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

DROP POLICY IF EXISTS "Authenticated users can create reviews" ON public.product_reviews;
CREATE POLICY "Authenticated users can create reviews"
  ON public.product_reviews FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Tenant admins can update reviews" ON public.product_reviews;
CREATE POLICY "Tenant admins can update reviews"
  ON public.product_reviews FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

-- Review Responses: Tenant admins can respond
DROP POLICY IF EXISTS "Anyone can view responses" ON public.review_responses;
CREATE POLICY "Anyone can view responses"
  ON public.review_responses FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Tenant admins can create responses" ON public.review_responses;
CREATE POLICY "Tenant admins can create responses"
  ON public.review_responses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- RPC Functions
-- ============================================================================

-- Mark messages as read
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_conversation_id UUID, p_user_id UUID)
RETURNS void
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.messages 
  SET read_at = now() 
  WHERE conversation_id = p_conversation_id 
  AND sender_id != p_user_id 
  AND read_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.mark_messages_read(UUID, UUID) TO authenticated;

-- Get unread message count
CREATE OR REPLACE FUNCTION public.get_unread_message_count(p_user_id UUID, p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.messages m
  JOIN public.conversations c ON m.conversation_id = c.id
  WHERE m.sender_id != p_user_id
  AND m.read_at IS NULL
  AND (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id);
  
  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_message_count(UUID, UUID) TO authenticated;

-- ============================================================================
-- Enable Realtime for messages
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============================================================================
-- Trigger for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS update_conversations_updated_at_trigger ON public.conversations;
CREATE TRIGGER update_conversations_updated_at_trigger
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversations_updated_at();

CREATE OR REPLACE FUNCTION public.update_product_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS update_product_reviews_updated_at_trigger ON public.product_reviews;
CREATE TRIGGER update_product_reviews_updated_at_trigger
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_reviews_updated_at();
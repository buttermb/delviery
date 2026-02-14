-- ============================================================================
-- CREDIT SYSTEM MIGRATION
-- ============================================================================
-- Implements a freemium credit system for usage-based billing
-- Free tier users get 10,000 credits/month, paid users have unlimited access
-- ============================================================================

-- Credit balances per tenant
CREATE TABLE IF NOT EXISTS public.tenant_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 10000,
  lifetime_earned INTEGER NOT NULL DEFAULT 10000,
  lifetime_spent INTEGER NOT NULL DEFAULT 0,
  last_free_grant_at TIMESTAMPTZ DEFAULT now(),
  next_free_grant_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  warning_25_sent BOOLEAN DEFAULT false,
  warning_10_sent BOOLEAN DEFAULT false,
  warning_5_sent BOOLEAN DEFAULT false,
  warning_0_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Credit transaction history
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- positive = earned, negative = spent
  balance_after INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('free_grant', 'purchase', 'usage', 'refund', 'bonus', 'adjustment')),
  action_type TEXT, -- 'create_order', 'generate_invoice', etc.
  reference_id UUID, -- order_id, invoice_id, etc.
  reference_type TEXT, -- 'order', 'invoice', 'product', etc.
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Credit packages for purchase
CREATE TABLE IF NOT EXISTS public.credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  credits INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  stripe_price_id TEXT,
  stripe_product_id TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  badge TEXT, -- 'POPULAR', 'BEST VALUE'
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Action credit costs configuration
CREATE TABLE IF NOT EXISTS public.credit_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key TEXT UNIQUE NOT NULL,
  action_name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Credit analytics for conversion tracking
CREATE TABLE IF NOT EXISTS public.credit_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'low_credit_warning_shown', 'purchase_modal_opened', 'converted_to_paid', 'credits_depleted'
  credits_at_event INTEGER,
  action_attempted TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add credit-related columns to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS is_free_tier BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS credits_enabled BOOLEAN DEFAULT true;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tenant_credits_tenant_id ON public.tenant_credits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_credits_next_grant ON public.tenant_credits(next_free_grant_at) WHERE next_free_grant_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_transactions_tenant_id ON public.credit_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON public.credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_analytics_tenant_id ON public.credit_analytics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_analytics_event_type ON public.credit_analytics(event_type);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.tenant_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_analytics ENABLE ROW LEVEL SECURITY;

-- tenant_credits policies
CREATE POLICY "Tenants can view own credits" ON public.tenant_credits
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all credits" ON public.tenant_credits
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- credit_transactions policies
CREATE POLICY "Tenants can view own transactions" ON public.credit_transactions
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all transactions" ON public.credit_transactions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- credit_packages policies (public read)
CREATE POLICY "Anyone can view active credit packages" ON public.credit_packages
  FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage packages" ON public.credit_packages
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- credit_costs policies (public read)
CREATE POLICY "Anyone can view active credit costs" ON public.credit_costs
  FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage costs" ON public.credit_costs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- credit_analytics policies
CREATE POLICY "Tenants can view own analytics" ON public.credit_analytics
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all analytics" ON public.credit_analytics
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- SEED DATA: Credit Packages
-- ============================================================================

INSERT INTO public.credit_packages (name, slug, credits, price_cents, sort_order, badge, description) VALUES
  ('Starter Pack', 'starter-pack', 2500, 1500, 1, NULL, 'Great for light usage'),
  ('Growth Pack', 'growth-pack', 7500, 4000, 2, 'POPULAR', 'Most popular for growing businesses'),
  ('Power Pack', 'power-pack', 20000, 9900, 3, 'BEST VALUE', 'Best value for heavy users')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  credits = EXCLUDED.credits,
  price_cents = EXCLUDED.price_cents,
  sort_order = EXCLUDED.sort_order,
  badge = EXCLUDED.badge,
  description = EXCLUDED.description,
  updated_at = now();

-- ============================================================================
-- SEED DATA: Credit Costs
-- ============================================================================

INSERT INTO public.credit_costs (action_key, action_name, credits, category, description) VALUES
  -- Orders (high cost - core revenue action)
  ('create_order', 'Create Order', 100, 'orders', 'Create a new order'),
  ('update_order_status', 'Update Order Status', 25, 'orders', 'Change order status'),
  ('cancel_order', 'Cancel Order', 10, 'orders', 'Cancel an existing order'),
  
  -- Products (medium cost)
  ('add_product', 'Add Product', 50, 'inventory', 'Add a new product to catalog'),
  ('edit_product', 'Edit Product', 15, 'inventory', 'Update product details'),
  ('delete_product', 'Delete Product', 5, 'inventory', 'Remove a product'),
  ('bulk_import_products', 'Bulk Import Products', 200, 'inventory', 'Import multiple products'),
  
  -- Customers (medium cost)
  ('add_customer', 'Add Customer', 30, 'customers', 'Add a new customer'),
  ('edit_customer', 'Edit Customer', 10, 'customers', 'Update customer details'),
  ('delete_customer', 'Delete Customer', 5, 'customers', 'Remove a customer'),
  
  -- Invoices (high cost - revenue action)
  ('generate_invoice', 'Generate Invoice', 75, 'finance', 'Create an invoice'),
  ('send_invoice', 'Send Invoice', 50, 'finance', 'Email invoice to customer'),
  ('record_payment', 'Record Payment', 25, 'finance', 'Record a payment'),
  
  -- Communication (medium cost)
  ('send_sms', 'Send SMS', 50, 'communication', 'Send SMS notification'),
  ('send_email', 'Send Email', 25, 'communication', 'Send email notification'),
  ('send_menu_link', 'Send Menu Link', 50, 'communication', 'Share disposable menu'),
  
  -- Reports/Exports (high cost - premium)
  ('generate_report', 'Generate Report', 150, 'reports', 'Generate analytics report'),
  ('export_csv', 'Export to CSV', 200, 'exports', 'Export data to CSV'),
  ('export_pdf', 'Export to PDF', 200, 'exports', 'Export data to PDF'),
  
  -- AI Features (premium cost)
  ('menu_ocr', 'Menu OCR Scan', 250, 'ai', 'AI-powered menu scanning'),
  ('ai_suggestions', 'AI Suggestions', 100, 'ai', 'AI product suggestions'),
  ('ai_analytics', 'AI Analytics', 150, 'ai', 'AI-powered insights'),
  
  -- API Access (per call)
  ('api_call', 'API Call', 25, 'api', 'External API request'),
  
  -- Menus
  ('create_menu', 'Create Menu', 75, 'menus', 'Create disposable menu'),
  ('share_menu', 'Share Menu', 25, 'menus', 'Share menu link')
ON CONFLICT (action_key) DO UPDATE SET
  action_name = EXCLUDED.action_name,
  credits = EXCLUDED.credits,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = now();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to check and deduct credits atomically
CREATE OR REPLACE FUNCTION public.consume_credits(
  p_tenant_id UUID,
  p_action_key TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance INTEGER,
  credits_cost INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost INTEGER;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_is_free_tier BOOLEAN;
BEGIN
  -- Get the credit cost for this action
  SELECT credits INTO v_cost
  FROM public.credit_costs
  WHERE action_key = p_action_key AND is_active = true;
  
  IF v_cost IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 'Unknown action: ' || p_action_key;
    RETURN;
  END IF;
  
  -- Check if tenant is on free tier
  SELECT is_free_tier INTO v_is_free_tier
  FROM public.tenants
  WHERE id = p_tenant_id;
  
  -- If not free tier, skip credit deduction
  IF v_is_free_tier IS NOT TRUE THEN
    RETURN QUERY SELECT true, -1, v_cost, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Get current balance with lock
  SELECT balance INTO v_current_balance
  FROM public.tenant_credits
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;
  
  -- If no credit record exists, create one
  IF v_current_balance IS NULL THEN
    INSERT INTO public.tenant_credits (tenant_id, balance)
    VALUES (p_tenant_id, 10000)
    ON CONFLICT (tenant_id) DO NOTHING;
    v_current_balance := 10000;
  END IF;
  
  -- Check if enough credits
  IF v_current_balance < v_cost THEN
    RETURN QUERY SELECT false, v_current_balance, v_cost, 'Insufficient credits. Need ' || v_cost || ', have ' || v_current_balance;
    RETURN;
  END IF;
  
  -- Deduct credits
  v_new_balance := v_current_balance - v_cost;
  
  UPDATE public.tenant_credits
  SET 
    balance = v_new_balance,
    lifetime_spent = lifetime_spent + v_cost,
    updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  -- Record transaction
  INSERT INTO public.credit_transactions (
    tenant_id,
    amount,
    balance_after,
    transaction_type,
    action_type,
    reference_id,
    reference_type,
    description
  ) VALUES (
    p_tenant_id,
    -v_cost,
    v_new_balance,
    'usage',
    p_action_key,
    p_reference_id,
    p_reference_type,
    COALESCE(p_description, 'Credit usage: ' || p_action_key)
  );
  
  RETURN QUERY SELECT true, v_new_balance, v_cost, NULL::TEXT;
END;
$$;

-- Function to grant free monthly credits
CREATE OR REPLACE FUNCTION public.grant_free_credits(
  p_tenant_id UUID,
  p_amount INTEGER DEFAULT 10000
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Get or create credit record
  INSERT INTO public.tenant_credits (tenant_id, balance, lifetime_earned)
  VALUES (p_tenant_id, p_amount, p_amount)
  ON CONFLICT (tenant_id) DO UPDATE SET
    balance = tenant_credits.balance + p_amount,
    lifetime_earned = tenant_credits.lifetime_earned + p_amount,
    last_free_grant_at = now(),
    next_free_grant_at = now() + interval '30 days',
    warning_25_sent = false,
    warning_10_sent = false,
    warning_5_sent = false,
    warning_0_sent = false,
    updated_at = now()
  RETURNING balance INTO v_new_balance;
  
  -- Record transaction
  INSERT INTO public.credit_transactions (
    tenant_id,
    amount,
    balance_after,
    transaction_type,
    description
  ) VALUES (
    p_tenant_id,
    p_amount,
    v_new_balance,
    'free_grant',
    'Monthly free credit grant'
  );
  
  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

-- Function to purchase credits
CREATE OR REPLACE FUNCTION public.purchase_credits(
  p_tenant_id UUID,
  p_amount INTEGER,
  p_stripe_payment_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Get or create credit record and add credits
  INSERT INTO public.tenant_credits (tenant_id, balance, lifetime_earned)
  VALUES (p_tenant_id, p_amount, p_amount)
  ON CONFLICT (tenant_id) DO UPDATE SET
    balance = tenant_credits.balance + p_amount,
    lifetime_earned = tenant_credits.lifetime_earned + p_amount,
    updated_at = now()
  RETURNING balance INTO v_new_balance;
  
  -- Record transaction
  INSERT INTO public.credit_transactions (
    tenant_id,
    amount,
    balance_after,
    transaction_type,
    description,
    metadata
  ) VALUES (
    p_tenant_id,
    p_amount,
    v_new_balance,
    'purchase',
    'Credit purchase: ' || p_amount || ' credits',
    jsonb_build_object('stripe_payment_id', p_stripe_payment_id)
  );
  
  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

-- Function to get credit balance
CREATE OR REPLACE FUNCTION public.get_credit_balance(p_tenant_id UUID)
RETURNS TABLE (
  balance INTEGER,
  lifetime_earned INTEGER,
  lifetime_spent INTEGER,
  is_free_tier BOOLEAN,
  next_free_grant_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(tc.balance, 10000),
    COALESCE(tc.lifetime_earned, 10000),
    COALESCE(tc.lifetime_spent, 0),
    COALESCE(t.is_free_tier, false),
    tc.next_free_grant_at
  FROM public.tenants t
  LEFT JOIN public.tenant_credits tc ON tc.tenant_id = t.id
  WHERE t.id = p_tenant_id;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.tenant_credits IS 'Tracks credit balances for free tier tenants';
COMMENT ON TABLE public.credit_transactions IS 'Audit log of all credit transactions';
COMMENT ON TABLE public.credit_packages IS 'Available credit packages for purchase';
COMMENT ON TABLE public.credit_costs IS 'Cost in credits for each action';
COMMENT ON TABLE public.credit_analytics IS 'Tracks credit-related events for conversion analysis';

COMMENT ON COLUMN public.tenants.is_free_tier IS 'Whether tenant is on the free credit-based tier';
COMMENT ON COLUMN public.tenants.credits_enabled IS 'Whether credit system is active for this tenant';




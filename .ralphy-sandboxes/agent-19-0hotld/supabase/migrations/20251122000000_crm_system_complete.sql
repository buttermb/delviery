-- ============================================================================
-- CRM SYSTEM COMPLETE MIGRATION
-- Implements client management, pre-orders, invoices, notes, and messaging
-- ============================================================================

-- ============================================================================
-- TABLES
-- ============================================================================

-- CRM Clients Table
CREATE TABLE IF NOT EXISTS public.crm_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Basic Info
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  
  -- Financial
  open_balance DECIMAL(10,2) DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  
  -- Client Portal Access
  portal_password_hash TEXT,
  portal_last_login TIMESTAMPTZ,
  
  -- Notifications
  notified_about_menu_update BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_client_email_per_account UNIQUE(account_id, email),
  CONSTRAINT unique_client_phone_per_account UNIQUE(account_id, phone)
);

-- CRM Pre-Orders Table
CREATE TABLE IF NOT EXISTS public.crm_pre_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  
  -- Pre-order Info
  pre_order_number TEXT NOT NULL,
  
  -- Line Items (JSON array)
  -- Each item: { product_name, quantity, unit_price, line_total }
  line_items JSONB DEFAULT '[]'::jsonb,
  
  -- Financial
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'cancelled')),
  
  -- Conversion
  converted_to_invoice_id UUID REFERENCES public.crm_invoices(id),
  converted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_pre_order_number_per_account UNIQUE(account_id, pre_order_number)
);

-- CRM Invoices Table
CREATE TABLE IF NOT EXISTS public.crm_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  
  -- Invoice Info
  invoice_number TEXT NOT NULL,
  
  -- Dates
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  
  -- Line Items (JSON array)
  -- Each item: { description, quantity, unit_price, line_total }
  line_items JSONB DEFAULT '[]'::jsonb,
  
  -- Financial
  subtotal DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
  paid_at TIMESTAMPTZ,
  
  -- Sharing
  public_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  
  -- Source
  created_from_pre_order_id UUID REFERENCES public.crm_pre_orders(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_invoice_number_per_account UNIQUE(account_id, invoice_number)
);

-- CRM Notes Table
CREATE TABLE IF NOT EXISTS public.crm_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  
  -- Note Content
  note_text TEXT NOT NULL,
  
  -- Metadata
  created_by_user_id UUID,
  created_by_name TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRM Messages Table
CREATE TABLE IF NOT EXISTS public.crm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  
  -- Message Content
  message_text TEXT NOT NULL,
  
  -- Sender Info
  sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'client')),
  sender_user_id UUID,
  sender_name TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRM Invites Table
CREATE TABLE IF NOT EXISTS public.crm_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Invite Info
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  
  -- Invite Link
  invite_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'archived')),
  
  -- Linked Client (after acceptance)
  client_id UUID REFERENCES public.crm_clients(id),
  
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRM Activity Log Table
CREATE TABLE IF NOT EXISTS public.crm_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  
  -- Activity Info
  activity_type TEXT NOT NULL,
  -- Types: 'pre_order_created', 'invoice_created', 'invoice_updated', 
  --        'payment_marked', 'note_added', 'invite_sent', 'invite_accepted'
  
  description TEXT NOT NULL,
  
  -- References
  reference_id UUID,
  reference_type TEXT,
  
  -- Metadata
  performed_by_user_id UUID,
  performed_by_name TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRM Settings Table
CREATE TABLE IF NOT EXISTS public.crm_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Settings
  telegram_video_link TEXT,
  menu_last_updated_at TIMESTAMPTZ,
  
  -- Returns/Refunds counter (simple field for MVP)
  returns_refunds_count INTEGER DEFAULT 0,
  
  -- FAQ (JSON array)
  -- Each item: { question, answer }
  faqs JSONB DEFAULT '[]'::jsonb,
  
  -- Subscription Info (simple text block)
  subscription_info TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_crm_settings_per_account UNIQUE(account_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- CRM Clients Indexes
CREATE INDEX IF NOT EXISTS idx_crm_clients_account_id ON public.crm_clients(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_clients_email ON public.crm_clients(email);
CREATE INDEX IF NOT EXISTS idx_crm_clients_phone ON public.crm_clients(phone);
CREATE INDEX IF NOT EXISTS idx_crm_clients_status ON public.crm_clients(status);

-- CRM Pre-Orders Indexes
CREATE INDEX IF NOT EXISTS idx_crm_pre_orders_account_id ON public.crm_pre_orders(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_pre_orders_client_id ON public.crm_pre_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_pre_orders_status ON public.crm_pre_orders(status);

-- CRM Invoices Indexes
CREATE INDEX IF NOT EXISTS idx_crm_invoices_account_id ON public.crm_invoices(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_invoices_client_id ON public.crm_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_invoices_status ON public.crm_invoices(status);
CREATE INDEX IF NOT EXISTS idx_crm_invoices_public_token ON public.crm_invoices(public_token);
CREATE INDEX IF NOT EXISTS idx_crm_invoices_due_date ON public.crm_invoices(due_date);

-- CRM Notes Indexes
CREATE INDEX IF NOT EXISTS idx_crm_notes_account_id ON public.crm_notes(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_notes_client_id ON public.crm_notes(client_id);

-- CRM Messages Indexes
CREATE INDEX IF NOT EXISTS idx_crm_messages_account_id ON public.crm_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_messages_client_id ON public.crm_messages(client_id);

-- CRM Invites Indexes
CREATE INDEX IF NOT EXISTS idx_crm_invites_account_id ON public.crm_invites(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_invites_status ON public.crm_invites(status);
CREATE INDEX IF NOT EXISTS idx_crm_invites_token ON public.crm_invites(invite_token);

-- CRM Activity Log Indexes
CREATE INDEX IF NOT EXISTS idx_crm_activity_log_account_id ON public.crm_activity_log(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_activity_log_client_id ON public.crm_activity_log(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_activity_log_created_at ON public.crm_activity_log(created_at DESC);

-- CRM Settings Indexes
CREATE INDEX IF NOT EXISTS idx_crm_settings_account_id ON public.crm_settings(account_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all CRM tables
ALTER TABLE public.crm_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pre_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES - Admin Access
-- ============================================================================

-- CRM Clients - Admin Access
CREATE POLICY "Admins can manage CRM clients"
ON public.crm_clients FOR ALL
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- CRM Pre-Orders - Admin Access
CREATE POLICY "Admins can manage CRM pre-orders"
ON public.crm_pre_orders FOR ALL
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- CRM Invoices - Admin Access
CREATE POLICY "Admins can manage CRM invoices"
ON public.crm_invoices FOR ALL
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- CRM Notes - Admin Access
CREATE POLICY "Admins can manage CRM notes"
ON public.crm_notes FOR ALL
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- CRM Messages - Admin Access
CREATE POLICY "Admins can manage CRM messages"
ON public.crm_messages FOR ALL
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- CRM Invites - Admin Access
CREATE POLICY "Admins can manage CRM invites"
ON public.crm_invites FOR ALL
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- CRM Activity Log - Admin Access
CREATE POLICY "Admins can view CRM activity logs"
ON public.crm_activity_log FOR SELECT
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Admins can insert CRM activity logs"
ON public.crm_activity_log FOR INSERT
TO authenticated
WITH CHECK (
  account_id IN (
    SELECT account_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- CRM Settings - Admin Access
CREATE POLICY "Admins can manage CRM settings"
ON public.crm_settings FOR ALL
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- ============================================================================
-- RLS POLICIES - Public/Anon Access (for client portal)
-- ============================================================================

-- Public invoice viewing by token (no auth required)
CREATE POLICY "Anyone can view invoices by public token"
ON public.crm_invoices FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Generate CRM Invoice Number
CREATE OR REPLACE FUNCTION public.generate_crm_invoice_number(p_account_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_count INTEGER;
  v_number TEXT;
BEGIN
  SELECT COUNT(*) INTO v_count 
  FROM public.crm_invoices 
  WHERE account_id = p_account_id;
  
  v_number := 'INV-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD((v_count + 1)::TEXT, 4, '0');
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Generate CRM Pre-Order Number
CREATE OR REPLACE FUNCTION public.generate_crm_pre_order_number(p_account_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_count INTEGER;
  v_number TEXT;
BEGIN
  SELECT COUNT(*) INTO v_count 
  FROM public.crm_pre_orders 
  WHERE account_id = p_account_id;
  
  v_number := 'PO-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD((v_count + 1)::TEXT, 4, '0');
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Update Client Open Balance
CREATE OR REPLACE FUNCTION public.update_client_open_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' OR TG_OP = 'INSERT') THEN
    UPDATE public.crm_clients
    SET open_balance = (
      SELECT COALESCE(SUM(total), 0)
      FROM public.crm_invoices
      WHERE client_id = NEW.client_id
        AND status IN ('sent', 'overdue')
    )
    WHERE id = NEW.client_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.crm_clients
    SET open_balance = (
      SELECT COALESCE(SUM(total), 0)
      FROM public.crm_invoices
      WHERE client_id = OLD.client_id
        AND status IN ('sent', 'overdue')
    )
    WHERE id = OLD.client_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Auto-set invoice number on insert
CREATE OR REPLACE FUNCTION public.set_crm_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := public.generate_crm_invoice_number(NEW.account_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-set pre-order number on insert
CREATE OR REPLACE FUNCTION public.set_crm_pre_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pre_order_number IS NULL OR NEW.pre_order_number = '' THEN
    NEW.pre_order_number := public.generate_crm_pre_order_number(NEW.account_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at triggers
CREATE TRIGGER update_crm_clients_updated_at
  BEFORE UPDATE ON public.crm_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_pre_orders_updated_at
  BEFORE UPDATE ON public.crm_pre_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_invoices_updated_at
  BEFORE UPDATE ON public.crm_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_settings_updated_at
  BEFORE UPDATE ON public.crm_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-number triggers
CREATE TRIGGER set_crm_invoice_number_trigger
  BEFORE INSERT ON public.crm_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_crm_invoice_number();

CREATE TRIGGER set_crm_pre_order_number_trigger
  BEFORE INSERT ON public.crm_pre_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_crm_pre_order_number();

-- Balance update triggers
CREATE TRIGGER trigger_update_client_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.crm_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_client_open_balance();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.crm_clients IS 'CRM client/customer records for account tenants';
COMMENT ON TABLE public.crm_pre_orders IS 'Pre-orders that can be converted to invoices';
COMMENT ON TABLE public.crm_invoices IS 'Invoices with public sharing tokens for client portal';
COMMENT ON TABLE public.crm_notes IS 'Internal notes about clients (admin-only)';
COMMENT ON TABLE public.crm_messages IS 'Message thread for client communication (internal for MVP)';
COMMENT ON TABLE public.crm_invites IS 'Client invitations with unique tokens';
COMMENT ON TABLE public.crm_activity_log IS 'Audit log of all client-related activities';
COMMENT ON TABLE public.crm_settings IS 'CRM settings per account (FAQs, subscription info, etc.)';

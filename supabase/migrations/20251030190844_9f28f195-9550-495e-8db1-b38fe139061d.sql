-- =====================================================
-- PHASE 1: MULTI-TENANT SAAS FOUNDATION
-- Transform single-tenant app to multi-tenant platform
-- =====================================================

-- 1. Create Plans Table
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price_monthly NUMERIC(10,2) NOT NULL,
  price_yearly NUMERIC(10,2),
  max_locations INTEGER NOT NULL,
  max_products INTEGER NOT NULL,
  max_team_members INTEGER NOT NULL,
  max_orders_per_month INTEGER,
  features JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plans
INSERT INTO plans (name, slug, description, price_monthly, price_yearly, max_locations, max_products, max_team_members, max_orders_per_month, features) VALUES
('Starter', 'starter', 'Perfect for new businesses', 99.00, 990.00, 1, 1000, 5, 500, '{"api_access": false, "white_label": false, "priority_support": false, "advanced_analytics": false}'),
('Professional', 'professional', 'Most popular for growing businesses', 299.00, 2990.00, 3, 5000, 15, 2000, '{"api_access": true, "white_label": false, "priority_support": true, "advanced_analytics": true}'),
('Enterprise', 'enterprise', 'Unlimited everything for large operations', 699.00, 6990.00, 999, 999999, 999, 999999, '{"api_access": true, "white_label": true, "priority_support": true, "advanced_analytics": true, "custom_integrations": true}');

-- 2. Create Accounts Table (Customer Businesses)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan_id UUID REFERENCES plans(id) ON DELETE RESTRICT,
  status TEXT DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'cancelled', 'suspended')),
  trial_ends_at TIMESTAMPTZ,
  billing_email TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create first account (BuddasH NYC)
INSERT INTO accounts (company_name, slug, plan_id, status)
SELECT 'BuddasH NYC', 'buddash-nyc', id, 'active'
FROM plans WHERE slug = 'enterprise' LIMIT 1;

-- 3. Create Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES plans(id) ON DELETE RESTRICT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Account Settings Table
CREATE TABLE IF NOT EXISTS account_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE UNIQUE NOT NULL,
  business_license TEXT,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  state TEXT,
  operating_states TEXT[] DEFAULT ARRAY[]::TEXT[],
  branding JSONB DEFAULT '{"logo_url": null, "primary_color": "#000000", "accent_color": "#FF6B35"}',
  compliance_settings JSONB DEFAULT '{}',
  notification_settings JSONB DEFAULT '{"email_enabled": true, "sms_enabled": true, "push_enabled": true}',
  integration_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Locations Table (Multi-Location Support)
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone TEXT,
  email TEXT,
  license_number TEXT,
  operating_hours JSONB DEFAULT '{}',
  delivery_radius_miles NUMERIC(5,2) DEFAULT 10,
  coordinates JSONB,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create Platform Invoices Table (Customer Subscription Billing)
CREATE TABLE IF NOT EXISTS platform_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  tax NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  stripe_invoice_id TEXT,
  payment_method TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create Support Tickets Table
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  assigned_to UUID,
  category TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 8. Create Vendors Table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  payment_terms TEXT DEFAULT 'Net 30',
  tax_id TEXT,
  license_number TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create Purchase Orders Table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE RESTRICT NOT NULL,
  po_number TEXT UNIQUE NOT NULL,
  location_id UUID REFERENCES locations(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'received', 'cancelled')),
  subtotal NUMERIC(10,2) NOT NULL,
  tax NUMERIC(10,2) DEFAULT 0,
  shipping NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  expected_delivery_date DATE,
  received_date DATE,
  notes TEXT,
  created_by UUID,
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Create Purchase Order Items Table
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(10,2) NOT NULL,
  total_cost NUMERIC(10,2) NOT NULL,
  received_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Create Customer Invoices Table (End Customer Invoicing)
CREATE TABLE IF NOT EXISTS customer_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  order_id UUID,
  subtotal NUMERIC(10,2) NOT NULL,
  tax NUMERIC(10,2) DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'overdue', 'cancelled')),
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, invoice_number)
);

-- 12. Create Payment Records Table (External Payment Tracking)
CREATE TABLE IF NOT EXISTS payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID NOT NULL,
  order_id UUID,
  invoice_id UUID REFERENCES customer_invoices(id),
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'venmo', 'zelle', 'check', 'card', 'other')),
  external_reference TEXT,
  notes TEXT,
  recorded_by UUID,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Create Customer Balances Table
CREATE TABLE IF NOT EXISTS customer_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID NOT NULL,
  store_credit NUMERIC(10,2) DEFAULT 0,
  prepaid_balance NUMERIC(10,2) DEFAULT 0,
  outstanding_balance NUMERIC(10,2) DEFAULT 0,
  lifetime_spend NUMERIC(10,2) DEFAULT 0,
  last_purchase_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, customer_id)
);

-- 14. Create Label Templates Table
CREATE TABLE IF NOT EXISTS label_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  state TEXT,
  label_type TEXT NOT NULL CHECK (label_type IN ('product', 'compliance', 'batch', 'delivery', 'warning')),
  template_html TEXT,
  template_config JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Create Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID NOT NULL,
  location_id UUID REFERENCES locations(id),
  appointment_type TEXT NOT NULL CHECK (appointment_type IN ('consultation', 'education', 'onboarding', 'medical_review')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  staff_member_id UUID,
  notes TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Create Medical Patient Info Table (Enhanced)
CREATE TABLE IF NOT EXISTS medical_patient_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID NOT NULL,
  card_number TEXT,
  card_expiration DATE,
  state_issued TEXT,
  physician_name TEXT,
  physician_phone TEXT,
  qualifying_conditions TEXT[],
  monthly_allotment INTEGER,
  dosage_recommendations TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, customer_id)
);

-- 17. Create Customer Notes Table
CREATE TABLE IF NOT EXISTS customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID NOT NULL,
  note TEXT NOT NULL,
  note_type TEXT DEFAULT 'general' CHECK (note_type IN ('general', 'preference', 'medical', 'complaint', 'compliment')),
  is_internal BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Create Inventory Adjustments Table
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  product_id UUID NOT NULL,
  location_id UUID REFERENCES locations(id),
  quantity_change INTEGER NOT NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('restock', 'sale', 'damage', 'transfer', 'theft', 'return', 'expired', 'other')),
  reason TEXT,
  reference_id UUID,
  adjusted_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. Create Inventory Transfers Table
CREATE TABLE IF NOT EXISTS inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  transfer_number TEXT UNIQUE NOT NULL,
  product_id UUID NOT NULL,
  from_location_id UUID REFERENCES locations(id) NOT NULL,
  to_location_id UUID REFERENCES locations(id) NOT NULL,
  quantity INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')),
  initiated_by UUID,
  completed_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 20. Create Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_slug ON accounts(slug);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_locations_account_id ON locations(account_id);
CREATE INDEX IF NOT EXISTS idx_locations_status ON locations(status);
CREATE INDEX IF NOT EXISTS idx_vendors_account_id ON vendors(account_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_account_id ON purchase_orders(account_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_account_id ON customer_invoices(account_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_customer_id ON customer_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_account_id ON payment_records(account_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_customer_id ON payment_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_balances_account_customer ON customer_balances(account_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_account_id ON appointments(account_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_medical_patient_info_account_customer ON medical_patient_info(account_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_account_customer ON customer_notes(account_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_account_product ON inventory_adjustments(account_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_account_id ON inventory_transfers(account_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_account_id ON activity_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_account_id ON support_tickets(account_id);

-- Enable RLS on all new tables
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_patient_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_account_settings_updated_at BEFORE UPDATE ON account_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_label_templates_updated_at BEFORE UPDATE ON label_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_medical_patient_info_updated_at BEFORE UPDATE ON medical_patient_info FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Generate unique numbers functions
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'PO-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'INV-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_transfer_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'TRN-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'TKT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
END;
$$ LANGUAGE plpgsql;

-- Set default values on insert
CREATE OR REPLACE FUNCTION set_po_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.po_number IS NULL THEN
    NEW.po_number := generate_po_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_po_number_trigger BEFORE INSERT ON purchase_orders FOR EACH ROW EXECUTE FUNCTION set_po_number();

CREATE OR REPLACE FUNCTION set_transfer_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transfer_number IS NULL THEN
    NEW.transfer_number := generate_transfer_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_transfer_number_trigger BEFORE INSERT ON inventory_transfers FOR EACH ROW EXECUTE FUNCTION set_transfer_number();

CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ticket_number_trigger BEFORE INSERT ON support_tickets FOR EACH ROW EXECUTE FUNCTION set_ticket_number();
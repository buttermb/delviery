-- ============================================================================
-- UNIFIED DATA ARCHITECTURE MIGRATION (Fixed)
-- Creates unified tables for orders and contacts
-- ============================================================================

-- 1. UNIFIED ORDERS TABLE
CREATE TABLE IF NOT EXISTS unified_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('retail', 'wholesale', 'menu', 'pos')),
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  wholesale_client_id UUID REFERENCES wholesale_clients(id) ON DELETE SET NULL,
  menu_id UUID REFERENCES disposable_menus(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES pos_shifts(id) ON DELETE SET NULL,
  delivery_address TEXT,
  delivery_notes TEXT,
  courier_id UUID REFERENCES couriers(id) ON DELETE SET NULL,
  contact_name TEXT,
  contact_phone TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  CONSTRAINT unified_orders_order_number_unique UNIQUE (tenant_id, order_number)
);

CREATE INDEX idx_unified_orders_tenant_id ON unified_orders(tenant_id);
CREATE INDEX idx_unified_orders_status ON unified_orders(status);
CREATE INDEX idx_unified_orders_created_at ON unified_orders(created_at DESC);

ALTER TABLE unified_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage own orders" ON unified_orders
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND status = 'active'));

-- 2. UNIFIED ORDER ITEMS
CREATE TABLE IF NOT EXISTS unified_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES unified_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  inventory_id UUID REFERENCES wholesale_inventory(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  sku TEXT,
  quantity NUMERIC(12,3) NOT NULL,
  quantity_unit TEXT NOT NULL DEFAULT 'unit',
  unit_price NUMERIC(12,2) NOT NULL,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_unified_order_items_order_id ON unified_order_items(order_id);

ALTER TABLE unified_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage own order items" ON unified_order_items
  USING (order_id IN (SELECT id FROM unified_orders WHERE tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND status = 'active'
  )));

-- 3. CONTACTS TABLE
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_type TEXT[] NOT NULL DEFAULT ARRAY['retail'],
  name TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT NOT NULL DEFAULT 'US',
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  business_name TEXT,
  business_license TEXT,
  tax_id TEXT,
  credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_terms TEXT NOT NULL DEFAULT 'net_30',
  client_type TEXT,
  account_manager_id UUID,
  lead_status TEXT,
  lead_source TEXT,
  assigned_to UUID,
  company_name TEXT,
  job_title TEXT,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  loyalty_tier TEXT,
  lifetime_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  age_verified BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  email_opt_in BOOLEAN NOT NULL DEFAULT true,
  sms_opt_in BOOLEAN NOT NULL DEFAULT true,
  preferred_contact_method TEXT NOT NULL DEFAULT 'email',
  notes TEXT,
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_contacted_at TIMESTAMPTZ,
  last_order_at TIMESTAMPTZ
);

CREATE INDEX idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX idx_contacts_contact_type ON contacts USING GIN(contact_type);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage own contacts" ON contacts
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND status = 'active'));

-- 4. RPC FUNCTIONS
CREATE OR REPLACE FUNCTION create_unified_order(
  p_tenant_id UUID, p_order_type TEXT, p_source TEXT, p_items JSONB,
  p_customer_id UUID DEFAULT NULL, p_wholesale_client_id UUID DEFAULT NULL,
  p_menu_id UUID DEFAULT NULL, p_shift_id UUID DEFAULT NULL,
  p_delivery_address TEXT DEFAULT NULL, p_delivery_notes TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL, p_courier_id UUID DEFAULT NULL,
  p_contact_name TEXT DEFAULT NULL, p_contact_phone TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE v_order_id UUID; v_order_number TEXT; v_item JSONB; v_total NUMERIC := 0;
BEGIN
  v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total := v_total + ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC);
  END LOOP;
  INSERT INTO unified_orders (tenant_id, order_number, order_type, source, status, subtotal, total_amount, 
    payment_method, payment_status, customer_id, wholesale_client_id, menu_id, shift_id, delivery_address, 
    delivery_notes, courier_id, contact_name, contact_phone, metadata)
  VALUES (p_tenant_id, v_order_number, p_order_type, p_source, 'pending', v_total, v_total, p_payment_method, 
    'unpaid', p_customer_id, p_wholesale_client_id, p_menu_id, p_shift_id, p_delivery_address, p_delivery_notes, 
    p_courier_id, p_contact_name, p_contact_phone, p_metadata)
  RETURNING id INTO v_order_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO unified_order_items (order_id, product_id, inventory_id, product_name, sku, quantity, quantity_unit, 
      unit_price, total_price, metadata)
    VALUES (v_order_id, (v_item->>'product_id')::UUID, (v_item->>'inventory_id')::UUID, v_item->>'product_name', 
      v_item->>'sku', (v_item->>'quantity')::NUMERIC, COALESCE(v_item->>'quantity_unit', 'unit'), 
      (v_item->>'unit_price')::NUMERIC, (v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC, 
      COALESCE(v_item->'metadata', '{}'));
  END LOOP;
  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION update_contact_balance(p_contact_id UUID, p_amount NUMERIC, p_operation TEXT) 
RETURNS NUMERIC AS $$
DECLARE v_new_balance NUMERIC;
BEGIN
  IF p_operation = 'add' THEN
    UPDATE contacts SET outstanding_balance = outstanding_balance + p_amount, updated_at = now()
    WHERE id = p_contact_id RETURNING outstanding_balance INTO v_new_balance;
  ELSE
    UPDATE contacts SET outstanding_balance = outstanding_balance - p_amount, updated_at = now()
    WHERE id = p_contact_id RETURNING outstanding_balance INTO v_new_balance;
  END IF;
  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION add_contact_type(p_contact_id UUID, p_contact_type TEXT) RETURNS VOID AS $$
BEGIN
  UPDATE contacts SET contact_type = array_append(contact_type, p_contact_type), updated_at = now()
  WHERE id = p_contact_id AND NOT (p_contact_type = ANY(contact_type));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
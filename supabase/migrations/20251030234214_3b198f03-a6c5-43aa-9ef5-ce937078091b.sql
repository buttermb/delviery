-- Customer CRM Tables for multi-tenant platform

-- Customers table (end customers)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  customer_type TEXT DEFAULT 'recreational' CHECK (customer_type IN ('medical', 'recreational')),
  
  -- Medical patient info
  medical_card_number TEXT,
  medical_card_state TEXT,
  medical_card_expiration DATE,
  physician_name TEXT,
  qualifying_conditions TEXT[],
  monthly_allotment_limit DECIMAL(10,2),
  caregiver_name TEXT,
  caregiver_phone TEXT,
  medical_card_photo_url TEXT,
  
  -- Preferences
  preferred_products TEXT[],
  preferred_strains TEXT[],
  preferred_consumption_method TEXT[],
  thc_preference TEXT,
  cbd_preference TEXT,
  allergies TEXT[],
  flavor_preferences TEXT[],
  
  -- Communication
  email_opt_in BOOLEAN DEFAULT true,
  sms_opt_in BOOLEAN DEFAULT true,
  marketing_opt_in BOOLEAN DEFAULT true,
  referral_source TEXT,
  
  -- Financial tracking
  total_spent DECIMAL(10,2) DEFAULT 0,
  loyalty_points INTEGER DEFAULT 0,
  loyalty_tier TEXT DEFAULT 'bronze',
  last_purchase_at TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Customer payments tracking
CREATE TABLE IF NOT EXISTS customer_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'debit', 'credit', 'check', 'venmo', 'zelle', 'cashapp', 'other')),
  external_payment_reference TEXT,
  payment_status TEXT DEFAULT 'completed' CHECK (payment_status IN ('completed', 'pending', 'failed', 'refunded')),
  notes TEXT,
  recorded_by UUID,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sales/Orders table enhancements
ALTER TABLE orders ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'in_store' CHECK (order_type IN ('in_store', 'delivery', 'pickup'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cashier_id UUID;

-- Product sales tracking
CREATE TABLE IF NOT EXISTS product_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  sold_at TIMESTAMPTZ DEFAULT now(),
  sold_by UUID
);

-- Loyalty rewards catalog
CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  reward_name TEXT NOT NULL,
  reward_description TEXT,
  points_required INTEGER NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('discount', 'free_product', 'free_delivery', 'other')),
  reward_value TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Customer reward redemptions
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES loyalty_rewards(id),
  order_id UUID REFERENCES orders(id),
  points_used INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT now()
);

-- Customer referrals
CREATE TABLE IF NOT EXISTS customer_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  referrer_customer_id UUID NOT NULL REFERENCES customers(id),
  referred_customer_id UUID NOT NULL REFERENCES customers(id),
  referral_status TEXT DEFAULT 'pending' CHECK (referral_status IN ('pending', 'completed', 'rewarded')),
  referrer_reward_points INTEGER DEFAULT 0,
  referred_reward_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_account_id ON customers(account_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_medical_card ON customers(medical_card_number) WHERE medical_card_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_account_id ON customer_payments(account_id);
CREATE INDEX IF NOT EXISTS idx_product_sales_account_id ON product_sales(account_id);
CREATE INDEX IF NOT EXISTS idx_product_sales_product_id ON product_sales(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_account_id ON orders(account_id);

-- RLS Policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_referrals ENABLE ROW LEVEL SECURITY;

-- Admins can manage customers in their account
CREATE POLICY "Account admins can manage customers" ON customers FOR ALL USING (
  account_id IN (SELECT account_id FROM admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Account admins can manage payments" ON customer_payments FOR ALL USING (
  account_id IN (SELECT account_id FROM admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Account admins can view sales" ON product_sales FOR ALL USING (
  account_id IN (SELECT account_id FROM admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Account admins can manage loyalty rewards" ON loyalty_rewards FOR ALL USING (
  account_id IN (SELECT account_id FROM admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Account admins can manage redemptions" ON reward_redemptions FOR ALL USING (
  account_id IN (SELECT account_id FROM admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Account admins can manage referrals" ON customer_referrals FOR ALL USING (
  account_id IN (SELECT account_id FROM admin_users WHERE user_id = auth.uid())
);

-- Update triggers
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
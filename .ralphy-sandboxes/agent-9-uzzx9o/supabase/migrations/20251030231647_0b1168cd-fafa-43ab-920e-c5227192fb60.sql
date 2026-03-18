-- ============================================
-- CONSIGNMENT & FRONTED INVENTORY SYSTEM
-- ============================================

-- 1. Enhance products table with barcode and consignment fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT UNIQUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS strain_name TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS thc_percent NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cbd_percent NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS retail_price NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS total_quantity INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS available_quantity INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS fronted_quantity INTEGER DEFAULT 0;

-- 2. Barcode Labels Table
CREATE TABLE IF NOT EXISTS barcode_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  
  barcode TEXT UNIQUE NOT NULL,
  barcode_type TEXT DEFAULT 'CODE128',
  
  label_template_id UUID,
  label_size TEXT DEFAULT 'standard',
  
  status TEXT DEFAULT 'active',
  printed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Inventory Locations Table
CREATE TABLE IF NOT EXISTS inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) NOT NULL,
  
  location_type TEXT NOT NULL,
  location_name TEXT NOT NULL,
  
  assigned_to_user_id UUID REFERENCES auth.users(id),
  
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  
  status TEXT DEFAULT 'active',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Fronted Inventory (Core Table)
CREATE TABLE IF NOT EXISTS fronted_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) NOT NULL,
  
  product_id UUID REFERENCES products(id) NOT NULL,
  batch_number TEXT,
  
  quantity_fronted INTEGER NOT NULL,
  quantity_sold INTEGER DEFAULT 0,
  quantity_returned INTEGER DEFAULT 0,
  quantity_damaged INTEGER DEFAULT 0,
  
  fronted_to_location_id UUID REFERENCES inventory_locations(id),
  fronted_to_user_id UUID REFERENCES auth.users(id),
  fronted_to_customer_name TEXT,
  
  deal_type TEXT NOT NULL,
  cost_per_unit NUMERIC NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  expected_revenue NUMERIC,
  expected_profit NUMERIC,
  
  payment_due_date DATE,
  payment_received NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  
  status TEXT DEFAULT 'active',
  
  dispatched_at TIMESTAMPTZ DEFAULT NOW(),
  dispatched_by UUID REFERENCES auth.users(id),
  
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Fronted Inventory Scans (Track Every Movement)
CREATE TABLE IF NOT EXISTS fronted_inventory_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) NOT NULL,
  fronted_inventory_id UUID REFERENCES fronted_inventory(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  
  barcode TEXT,
  scan_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  
  location_id UUID REFERENCES inventory_locations(id),
  
  scanned_by UUID REFERENCES auth.users(id),
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  
  latitude NUMERIC,
  longitude NUMERIC,
  
  notes TEXT
);

-- 6. Payments for Fronted Inventory
CREATE TABLE IF NOT EXISTS fronted_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) NOT NULL,
  fronted_inventory_id UUID REFERENCES fronted_inventory(id) ON DELETE CASCADE,
  
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  payment_reference TEXT,
  
  paid_by_user_id UUID REFERENCES auth.users(id),
  paid_by_name TEXT,
  
  received_by UUID REFERENCES auth.users(id),
  received_at TIMESTAMPTZ DEFAULT NOW(),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Barcode Labels Policies
ALTER TABLE barcode_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view barcode labels in their account"
  ON barcode_labels FOR SELECT
  USING (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create barcode labels in their account"
  ON barcode_labels FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update barcode labels in their account"
  ON barcode_labels FOR UPDATE
  USING (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete barcode labels in their account"
  ON barcode_labels FOR DELETE
  USING (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

-- Inventory Locations Policies
ALTER TABLE inventory_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inventory locations in their account"
  ON inventory_locations FOR SELECT
  USING (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create inventory locations in their account"
  ON inventory_locations FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update inventory locations in their account"
  ON inventory_locations FOR UPDATE
  USING (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete inventory locations in their account"
  ON inventory_locations FOR DELETE
  USING (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

-- Fronted Inventory Policies
ALTER TABLE fronted_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view fronted inventory in their account"
  ON fronted_inventory FOR SELECT
  USING (
    account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid())
    OR fronted_to_user_id = auth.uid()
  );

CREATE POLICY "Users can create fronted inventory in their account"
  ON fronted_inventory FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update fronted inventory in their account"
  ON fronted_inventory FOR UPDATE
  USING (
    account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid())
    OR fronted_to_user_id = auth.uid()
  );

CREATE POLICY "Users can delete fronted inventory in their account"
  ON fronted_inventory FOR DELETE
  USING (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

-- Fronted Inventory Scans Policies
ALTER TABLE fronted_inventory_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view fronted inventory scans in their account"
  ON fronted_inventory_scans FOR SELECT
  USING (
    account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid())
    OR scanned_by = auth.uid()
  );

CREATE POLICY "Users can create fronted inventory scans"
  ON fronted_inventory_scans FOR INSERT
  WITH CHECK (
    account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid())
    OR scanned_by = auth.uid()
  );

-- Fronted Payments Policies
ALTER TABLE fronted_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view fronted payments in their account"
  ON fronted_payments FOR SELECT
  USING (
    account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid())
    OR paid_by_user_id = auth.uid()
  );

CREATE POLICY "Users can create fronted payments"
  ON fronted_payments FOR INSERT
  WITH CHECK (
    account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid())
    OR paid_by_user_id = auth.uid()
  );

CREATE POLICY "Users can update fronted payments in their account"
  ON fronted_payments FOR UPDATE
  USING (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_barcode_labels_account ON barcode_labels(account_id);
CREATE INDEX IF NOT EXISTS idx_barcode_labels_product ON barcode_labels(product_id);
CREATE INDEX IF NOT EXISTS idx_barcode_labels_barcode ON barcode_labels(barcode);

CREATE INDEX IF NOT EXISTS idx_inventory_locations_account ON inventory_locations(account_id);
CREATE INDEX IF NOT EXISTS idx_inventory_locations_user ON inventory_locations(assigned_to_user_id);

CREATE INDEX IF NOT EXISTS idx_fronted_inventory_account ON fronted_inventory(account_id);
CREATE INDEX IF NOT EXISTS idx_fronted_inventory_status ON fronted_inventory(status);
CREATE INDEX IF NOT EXISTS idx_fronted_inventory_payment_status ON fronted_inventory(payment_status);
CREATE INDEX IF NOT EXISTS idx_fronted_inventory_due_date ON fronted_inventory(payment_due_date);
CREATE INDEX IF NOT EXISTS idx_fronted_inventory_user ON fronted_inventory(fronted_to_user_id);

CREATE INDEX IF NOT EXISTS idx_fronted_scans_inventory ON fronted_inventory_scans(fronted_inventory_id);
CREATE INDEX IF NOT EXISTS idx_fronted_scans_user ON fronted_inventory_scans(scanned_by);

CREATE INDEX IF NOT EXISTS idx_fronted_payments_inventory ON fronted_payments(fronted_inventory_id);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_inventory_locations_updated_at
  BEFORE UPDATE ON inventory_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fronted_inventory_updated_at
  BEFORE UPDATE ON fronted_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
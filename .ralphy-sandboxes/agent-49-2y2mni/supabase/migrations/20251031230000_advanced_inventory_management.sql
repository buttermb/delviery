-- ============================================
-- ADVANCED INVENTORY MANAGEMENT SYSTEM
-- Complete tracking: Supplier → Warehouse → Runner → Customer
-- ============================================

-- 1. INVENTORY BATCHES TABLE
-- Track product batches with full test results and compliance data
CREATE TABLE IF NOT EXISTS inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) NOT NULL,
  
  batch_number TEXT UNIQUE NOT NULL, -- e.g., "BD-2024-001"
  product_id UUID REFERENCES products(id) NOT NULL,
  
  -- Supplier Information
  supplier_name TEXT,
  supplier_location TEXT,
  received_from_location_id UUID REFERENCES inventory_locations(id),
  
  -- Batch Details
  harvest_date DATE,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_quantity_lbs NUMERIC(10, 2) NOT NULL,
  remaining_quantity_lbs NUMERIC(10, 2) NOT NULL, -- Updated as packages are created
  
  -- Test Results
  test_results JSONB DEFAULT '{}', -- {thc: 24.5, cbd: 0.3, lab: "Green Labs", test_date: "2024-10-20"}
  lab_name TEXT,
  test_date DATE,
  coa_url TEXT, -- Certificate of Analysis URL
  coa_qr_code_url TEXT,
  
  -- Compliance
  expiration_date DATE,
  compliance_status TEXT DEFAULT 'pending', -- pending, verified, failed
  
  -- Status
  status TEXT DEFAULT 'active', -- active, depleted, expired, quarantined
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. INVENTORY PACKAGES TABLE
-- Individual packages created from batches
CREATE TABLE IF NOT EXISTS inventory_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) NOT NULL,
  
  package_number TEXT UNIQUE NOT NULL, -- e.g., "PKG-BD-2024-001-001"
  product_id UUID REFERENCES products(id) NOT NULL,
  batch_id UUID REFERENCES inventory_batches(id) NOT NULL,
  
  -- Package Details
  quantity_lbs NUMERIC(10, 2) NOT NULL,
  unit TEXT DEFAULT 'lbs',
  
  -- Location Tracking
  current_location_id UUID REFERENCES inventory_locations(id),
  previous_location_id UUID REFERENCES inventory_locations(id),
  
  -- Status
  status TEXT DEFAULT 'available', -- available, reserved, in_transit, delivered, sold, damaged, returned
  
  -- Order/Transfer Association
  reserved_for_order_id UUID REFERENCES orders(id),
  reserved_for_transfer_id UUID, -- References inventory_transfers (will be created)
  
  -- Package Dates
  packaged_date TIMESTAMPTZ DEFAULT NOW(),
  expiration_date DATE,
  
  -- Barcode/QR
  barcode TEXT UNIQUE NOT NULL, -- Code128 barcode
  qr_code_data JSONB, -- Full tracking data as JSON
  
  -- Chain of Custody (will be populated by scans)
  chain_of_custody JSONB DEFAULT '[]', -- Array of custody events
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 3. ENHANCED INVENTORY TRANSFERS TABLE
-- Complete transfer workflow with GPS tracking
CREATE TABLE IF NOT EXISTS inventory_transfers_enhanced (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) NOT NULL,
  
  transfer_number TEXT UNIQUE NOT NULL, -- e.g., "TRN-2024-045"
  
  -- Locations
  from_location_id UUID REFERENCES inventory_locations(id) NOT NULL,
  to_location_id UUID REFERENCES inventory_locations(id) NOT NULL,
  
  -- Assignment
  runner_id UUID REFERENCES auth.users(id), -- Courier/runner assigned
  vehicle_info JSONB, -- {make: "Honda Accord", plate: "ABC-1234"}
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, approved, in_progress, in_transit, delivered, completed, cancelled
  
  -- Packages in Transfer
  packages JSONB DEFAULT '[]', -- Array of {package_id, quantity_lbs}
  total_quantity_lbs NUMERIC(10, 2),
  total_value NUMERIC(10, 2),
  
  -- Order Association (if transfer is for an order)
  order_id UUID REFERENCES orders(id),
  
  -- Tracking
  gps_tracking JSONB DEFAULT '[]', -- Array of {lat, lng, timestamp}
  current_lat NUMERIC(10, 8),
  current_lng NUMERIC(11, 8),
  last_gps_update TIMESTAMPTZ,
  eta TIMESTAMPTZ,
  
  -- Approval
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Completion
  received_by UUID REFERENCES auth.users(id),
  delivery_signature TEXT, -- Base64 signature image
  delivery_photos TEXT[], -- Array of photo URLs
  
  -- Manifest
  manifest_qr_code TEXT, -- QR code for transfer manifest
  manifest_printed_at TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 4. PACKAGE SCANS TABLE
-- Every scan of a package (chain of custody)
CREATE TABLE IF NOT EXISTS package_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) NOT NULL,
  
  package_id UUID REFERENCES inventory_packages(id) NOT NULL,
  transfer_id UUID REFERENCES inventory_transfers_enhanced(id),
  
  -- Scan Details
  scan_type TEXT NOT NULL, -- received, packaged, transfer_pickup, transfer_delivery, sold, returned, damaged
  scanned_by UUID REFERENCES auth.users(id) NOT NULL,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Location
  location_id UUID REFERENCES inventory_locations(id),
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  
  -- Context
  action TEXT, -- What happened: "Received from supplier", "Picked up for transfer", "Delivered to customer"
  previous_status TEXT,
  new_status TEXT,
  
  -- Metadata
  device_info JSONB, -- {device_id, app_version, platform}
  notes TEXT
);

-- 5. LABEL PRINT QUEUE TABLE
-- Queue of labels to be printed
CREATE TABLE IF NOT EXISTS label_print_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) NOT NULL,
  
  -- What to print
  label_type TEXT NOT NULL, -- product, batch, package, transfer_manifest, small_package
  entity_id UUID NOT NULL, -- References package_id, batch_id, transfer_id, etc.
  entity_type TEXT NOT NULL, -- package, batch, transfer
  
  -- Label Details
  label_template TEXT DEFAULT 'standard', -- standard, small, large
  label_size TEXT DEFAULT '4x6', -- 4x6, 2x1, etc.
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, printing, completed, failed
  priority INTEGER DEFAULT 0, -- Higher = more urgent
  
  -- Printing
  printer_name TEXT,
  printed_at TIMESTAMPTZ,
  printed_by UUID REFERENCES auth.users(id),
  print_count INTEGER DEFAULT 1, -- How many copies
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 6. INVENTORY LOCATION CAPACITY
-- Track capacity and utilization for each location
ALTER TABLE inventory_locations 
  ADD COLUMN IF NOT EXISTS capacity_lbs NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS current_stock_lbs NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS location_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS gps_coordinates JSONB; -- {lat, lng}

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_batches_account ON inventory_batches(account_id);
CREATE INDEX IF NOT EXISTS idx_batches_product ON inventory_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_number ON inventory_batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_batches_status ON inventory_batches(status);

CREATE INDEX IF NOT EXISTS idx_packages_account ON inventory_packages(account_id);
CREATE INDEX IF NOT EXISTS idx_packages_product ON inventory_packages(product_id);
CREATE INDEX IF NOT EXISTS idx_packages_batch ON inventory_packages(batch_id);
CREATE INDEX IF NOT EXISTS idx_packages_location ON inventory_packages(current_location_id);
CREATE INDEX IF NOT EXISTS idx_packages_status ON inventory_packages(status);
CREATE INDEX IF NOT EXISTS idx_packages_number ON inventory_packages(package_number);
CREATE INDEX IF NOT EXISTS idx_packages_barcode ON inventory_packages(barcode);
CREATE INDEX IF NOT EXISTS idx_packages_order ON inventory_packages(reserved_for_order_id);
CREATE INDEX IF NOT EXISTS idx_packages_transfer ON inventory_packages(reserved_for_transfer_id);

CREATE INDEX IF NOT EXISTS idx_transfers_account ON inventory_transfers_enhanced(account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from_location ON inventory_transfers_enhanced(from_location_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_location ON inventory_transfers_enhanced(to_location_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON inventory_transfers_enhanced(status);
CREATE INDEX IF NOT EXISTS idx_transfers_runner ON inventory_transfers_enhanced(runner_id);
CREATE INDEX IF NOT EXISTS idx_transfers_number ON inventory_transfers_enhanced(transfer_number);
CREATE INDEX IF NOT EXISTS idx_transfers_order ON inventory_transfers_enhanced(order_id);
CREATE INDEX IF NOT EXISTS idx_transfers_scheduled ON inventory_transfers_enhanced(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_scans_package ON package_scans(package_id);
CREATE INDEX IF NOT EXISTS idx_scans_transfer ON package_scans(transfer_id);
CREATE INDEX IF NOT EXISTS idx_scans_user ON package_scans(scanned_by);
CREATE INDEX IF NOT EXISTS idx_scans_location ON package_scans(location_id);
CREATE INDEX IF NOT EXISTS idx_scans_type ON package_scans(scan_type);
CREATE INDEX IF NOT EXISTS idx_scans_time ON package_scans(scanned_at);

CREATE INDEX IF NOT EXISTS idx_print_queue_account ON label_print_queue(account_id);
CREATE INDEX IF NOT EXISTS idx_print_queue_status ON label_print_queue(status);
CREATE INDEX IF NOT EXISTS idx_print_queue_priority ON label_print_queue(priority DESC);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Inventory Batches
ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view batches in their account"
  ON inventory_batches FOR SELECT
  USING (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create batches in their account"
  ON inventory_batches FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update batches in their account"
  ON inventory_batches FOR UPDATE
  USING (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

-- Inventory Packages
ALTER TABLE inventory_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view packages in their account"
  ON inventory_packages FOR SELECT
  USING (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create packages in their account"
  ON inventory_packages FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update packages in their account"
  ON inventory_packages FOR UPDATE
  USING (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

-- Enhanced Transfers
ALTER TABLE inventory_transfers_enhanced ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transfers in their account"
  ON inventory_transfers_enhanced FOR SELECT
  USING (
    account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid())
    OR runner_id = auth.uid()
  );

CREATE POLICY "Users can create transfers in their account"
  ON inventory_transfers_enhanced FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update transfers in their account"
  ON inventory_transfers_enhanced FOR UPDATE
  USING (
    account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid())
    OR runner_id = auth.uid()
  );

-- Package Scans
ALTER TABLE package_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scans in their account"
  ON package_scans FOR SELECT
  USING (
    account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid())
    OR scanned_by = auth.uid()
  );

CREATE POLICY "Users can create scans"
  ON package_scans FOR INSERT
  WITH CHECK (
    account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid())
    OR scanned_by = auth.uid()
  );

-- Label Print Queue
ALTER TABLE label_print_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view print queue in their account"
  ON label_print_queue FOR SELECT
  USING (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage print queue in their account"
  ON label_print_queue FOR ALL
  USING (account_id IN (SELECT account_id FROM user_roles WHERE user_id = auth.uid()));

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE TRIGGER update_batches_updated_at
  BEFORE UPDATE ON inventory_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_packages_updated_at
  BEFORE UPDATE ON inventory_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transfers_updated_at
  BEFORE UPDATE ON inventory_transfers_enhanced
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate batch numbers
CREATE OR REPLACE FUNCTION generate_batch_number()
RETURNS TRIGGER AS $$
DECLARE
  product_sku TEXT;
  year_prefix TEXT;
  batch_seq INTEGER;
  new_batch_number TEXT;
BEGIN
  -- Get product SKU prefix (first 2-3 letters or use product name initials)
  SELECT UPPER(SUBSTRING(COALESCE(NEW.strain_name, p.name, 'GEN'), 1, 2))
  INTO product_sku
  FROM products p
  WHERE p.id = NEW.product_id;
  
  -- Get year
  year_prefix := TO_CHAR(NOW(), 'YYYY');
  
  -- Get next sequence number for this product/year
  SELECT COALESCE(MAX((SUBSTRING(batch_number FROM '[0-9]+$'))::INTEGER), 0) + 1
  INTO batch_seq
  FROM inventory_batches
  WHERE batch_number LIKE product_sku || '-' || year_prefix || '-%'
    AND account_id = NEW.account_id;
  
  -- Format: BD-2024-001
  new_batch_number := product_sku || '-' || year_prefix || '-' || LPAD(batch_seq::TEXT, 3, '0');
  
  NEW.batch_number := new_batch_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_generate_batch_number
  BEFORE INSERT ON inventory_batches
  FOR EACH ROW
  WHEN (NEW.batch_number IS NULL OR NEW.batch_number = '')
  EXECUTE FUNCTION generate_batch_number();

-- Auto-generate package numbers
CREATE OR REPLACE FUNCTION generate_package_number()
RETURNS TRIGGER AS $$
DECLARE
  batch_num TEXT;
  package_seq INTEGER;
  new_package_number TEXT;
BEGIN
  -- Get batch number
  SELECT batch_number INTO batch_num
  FROM inventory_batches
  WHERE id = NEW.batch_id;
  
  -- Get next package sequence for this batch
  SELECT COALESCE(MAX((SUBSTRING(package_number FROM '[0-9]+$'))::INTEGER), 0) + 1
  INTO package_seq
  FROM inventory_packages
  WHERE batch_id = NEW.batch_id;
  
  -- Format: PKG-BD-2024-001-001
  new_package_number := 'PKG-' || batch_num || '-' || LPAD(package_seq::TEXT, 3, '0');
  
  NEW.package_number := new_package_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_generate_package_number
  BEFORE INSERT ON inventory_packages
  FOR EACH ROW
  WHEN (NEW.package_number IS NULL OR NEW.package_number = '')
  EXECUTE FUNCTION generate_package_number();

-- Auto-generate transfer numbers
CREATE OR REPLACE FUNCTION generate_transfer_number()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix TEXT;
  transfer_seq INTEGER;
  new_transfer_number TEXT;
BEGIN
  year_prefix := TO_CHAR(NOW(), 'YYYY');
  
  -- Get next sequence for this year
  SELECT COALESCE(MAX((SUBSTRING(transfer_number FROM '[0-9]+$'))::INTEGER), 0) + 1
  INTO transfer_seq
  FROM inventory_transfers_enhanced
  WHERE transfer_number LIKE 'TRN-' || year_prefix || '-%'
    AND account_id = NEW.account_id;
  
  -- Format: TRN-2024-045
  new_transfer_number := 'TRN-' || year_prefix || '-' || LPAD(transfer_seq::TEXT, 3, '0');
  
  NEW.transfer_number := new_transfer_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_generate_transfer_number
  BEFORE INSERT ON inventory_transfers_enhanced
  FOR EACH ROW
  WHEN (NEW.transfer_number IS NULL OR NEW.transfer_number = '')
  EXECUTE FUNCTION generate_transfer_number();

-- Update batch remaining quantity when package is created
CREATE OR REPLACE FUNCTION update_batch_quantity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Subtract from batch
    UPDATE inventory_batches
    SET remaining_quantity_lbs = remaining_quantity_lbs - NEW.quantity_lbs
    WHERE id = NEW.batch_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Add back to batch
    UPDATE inventory_batches
    SET remaining_quantity_lbs = remaining_quantity_lbs + OLD.quantity_lbs
    WHERE id = OLD.batch_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.quantity_lbs != NEW.quantity_lbs THEN
    -- Adjust difference
    UPDATE inventory_batches
    SET remaining_quantity_lbs = remaining_quantity_lbs - (NEW.quantity_lbs - OLD.quantity_lbs)
    WHERE id = NEW.batch_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_batch_on_package_change
  AFTER INSERT OR UPDATE OR DELETE ON inventory_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_quantity();

-- Update location stock when package location changes
CREATE OR REPLACE FUNCTION update_location_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Remove from old location
  IF OLD.current_location_id IS NOT NULL AND (OLD.current_location_id != NEW.current_location_id OR TG_OP = 'DELETE') THEN
    UPDATE inventory_locations
    SET current_stock_lbs = GREATEST(0, current_stock_lbs - OLD.quantity_lbs)
    WHERE id = OLD.current_location_id;
  END IF;
  
  -- Add to new location
  IF NEW.current_location_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.current_location_id != NEW.current_location_id) THEN
    UPDATE inventory_locations
    SET current_stock_lbs = current_stock_lbs + NEW.quantity_lbs
    WHERE id = NEW.current_location_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_location_on_package_change
  AFTER INSERT OR UPDATE OR DELETE ON inventory_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_location_stock();

COMMENT ON TABLE inventory_batches IS 'Product batches with test results and compliance tracking';
COMMENT ON TABLE inventory_packages IS 'Individual packages created from batches, tracked through system';
COMMENT ON TABLE inventory_transfers_enhanced IS 'Complete transfer workflow with GPS tracking';
COMMENT ON TABLE package_scans IS 'Chain of custody - every scan event for compliance';
COMMENT ON TABLE label_print_queue IS 'Queue of labels waiting to be printed';


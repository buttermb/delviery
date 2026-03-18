-- ============================================
-- VENDOR PAYMENT TERMS MIGRATION
-- Stores payment terms per vendor (net 15/30/60, COD, prepaid)
-- Auto-calculates payment due dates on POs
-- ============================================

-- Create vendor_payment_terms table
CREATE TABLE IF NOT EXISTS vendor_payment_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  payment_term_type TEXT NOT NULL DEFAULT 'net_30'
    CHECK (payment_term_type IN ('cod', 'prepaid', 'net_7', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90', 'custom')),
  custom_days INTEGER CHECK (custom_days IS NULL OR custom_days > 0),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_vendor_payment_terms UNIQUE (tenant_id, vendor_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_payment_terms_tenant_id ON vendor_payment_terms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payment_terms_vendor_id ON vendor_payment_terms(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payment_terms_type ON vendor_payment_terms(payment_term_type);

-- Add payment_due_date to purchase_orders if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'payment_due_date'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN payment_due_date DATE;
  END IF;
END $$;

-- Create index for payment_due_date queries
CREATE INDEX IF NOT EXISTS idx_purchase_orders_payment_due_date ON purchase_orders(payment_due_date);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

ALTER TABLE vendor_payment_terms ENABLE ROW LEVEL SECURITY;

-- SELECT policy
DROP POLICY IF EXISTS "Tenant members can view vendor payment terms" ON vendor_payment_terms;
CREATE POLICY "Tenant members can view vendor payment terms"
  ON vendor_payment_terms FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- INSERT policy
DROP POLICY IF EXISTS "Tenant members can insert vendor payment terms" ON vendor_payment_terms;
CREATE POLICY "Tenant members can insert vendor payment terms"
  ON vendor_payment_terms FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- UPDATE policy
DROP POLICY IF EXISTS "Tenant members can update vendor payment terms" ON vendor_payment_terms;
CREATE POLICY "Tenant members can update vendor payment terms"
  ON vendor_payment_terms FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- DELETE policy
DROP POLICY IF EXISTS "Tenant members can delete vendor payment terms" ON vendor_payment_terms;
CREATE POLICY "Tenant members can delete vendor payment terms"
  ON vendor_payment_terms FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- TRIGGER FOR updated_at
-- ============================================

DROP TRIGGER IF EXISTS update_vendor_payment_terms_updated_at ON vendor_payment_terms;
CREATE TRIGGER update_vendor_payment_terms_updated_at
  BEFORE UPDATE ON vendor_payment_terms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION TO CALCULATE PAYMENT DUE DATE
-- ============================================

CREATE OR REPLACE FUNCTION get_payment_term_days(term_type TEXT, custom_days INTEGER DEFAULT NULL)
RETURNS INTEGER AS $$
BEGIN
  CASE term_type
    WHEN 'cod' THEN RETURN 0;
    WHEN 'prepaid' THEN RETURN -1; -- Due before order
    WHEN 'net_7' THEN RETURN 7;
    WHEN 'net_15' THEN RETURN 15;
    WHEN 'net_30' THEN RETURN 30;
    WHEN 'net_45' THEN RETURN 45;
    WHEN 'net_60' THEN RETURN 60;
    WHEN 'net_90' THEN RETURN 90;
    WHEN 'custom' THEN RETURN COALESCE(custom_days, 30);
    ELSE RETURN 30; -- Default to net 30
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- FUNCTION TO SET PO PAYMENT DUE DATE
-- ============================================

CREATE OR REPLACE FUNCTION set_po_payment_due_date()
RETURNS TRIGGER AS $$
DECLARE
  v_term_type TEXT;
  v_custom_days INTEGER;
  v_days INTEGER;
  v_base_date DATE;
BEGIN
  -- Get vendor payment terms
  SELECT payment_term_type, custom_days
  INTO v_term_type, v_custom_days
  FROM vendor_payment_terms
  WHERE tenant_id = NEW.account_id
    AND vendor_id = NEW.vendor_id;

  -- Default to net_30 if no terms set
  IF v_term_type IS NULL THEN
    v_term_type := 'net_30';
  END IF;

  -- Calculate days until payment due
  v_days := get_payment_term_days(v_term_type, v_custom_days);

  -- Use order date or created_at as base
  v_base_date := COALESCE(NEW.order_date::DATE, NEW.created_at::DATE, CURRENT_DATE);

  -- Set payment due date
  IF v_days >= 0 THEN
    NEW.payment_due_date := v_base_date + v_days;
  ELSE
    -- For prepaid, due date is the order date itself
    NEW.payment_due_date := v_base_date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new POs
DROP TRIGGER IF EXISTS set_po_payment_due_date_trigger ON purchase_orders;
CREATE TRIGGER set_po_payment_due_date_trigger
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW
  WHEN (NEW.payment_due_date IS NULL)
  EXECUTE FUNCTION set_po_payment_due_date();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE vendor_payment_terms IS 'Stores payment terms configuration per vendor';
COMMENT ON COLUMN vendor_payment_terms.payment_term_type IS 'Type of payment terms: cod, prepaid, net_7, net_15, net_30, net_45, net_60, net_90, custom';
COMMENT ON COLUMN vendor_payment_terms.custom_days IS 'Number of days for custom payment terms';
COMMENT ON FUNCTION get_payment_term_days IS 'Returns number of days until payment due based on term type';
COMMENT ON FUNCTION set_po_payment_due_date IS 'Automatically sets payment_due_date on new purchase orders based on vendor terms';

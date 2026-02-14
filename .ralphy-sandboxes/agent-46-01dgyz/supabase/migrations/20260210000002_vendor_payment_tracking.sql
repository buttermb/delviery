-- ============================================
-- VENDOR PAYMENT TRACKING MIGRATION
-- Adds vendor_payments table to track payments made to vendors
-- Links payments to purchase orders with outstanding balance tracking
-- ============================================

-- Create vendor_payments table
CREATE TABLE IF NOT EXISTS vendor_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'check', 'bank_transfer', 'credit_card', 'ach', 'wire', 'other')),
  reference_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_payments_tenant_id ON vendor_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_vendor_id ON vendor_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_purchase_order_id ON vendor_payments(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_payment_date ON vendor_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_created_at ON vendor_payments(created_at DESC);

-- Add payment tracking columns to purchase_orders if not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN payment_status TEXT DEFAULT 'unpaid'
      CHECK (payment_status IN ('unpaid', 'partial', 'paid'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'paid_amount'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN paid_amount NUMERIC(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'payment_date'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN payment_date DATE;
  END IF;
END $$;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

ALTER TABLE vendor_payments ENABLE ROW LEVEL SECURITY;

-- SELECT policy
DROP POLICY IF EXISTS "Tenant members can view vendor payments" ON vendor_payments;
CREATE POLICY "Tenant members can view vendor payments"
  ON vendor_payments FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- INSERT policy
DROP POLICY IF EXISTS "Tenant members can insert vendor payments" ON vendor_payments;
CREATE POLICY "Tenant members can insert vendor payments"
  ON vendor_payments FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- UPDATE policy
DROP POLICY IF EXISTS "Tenant members can update vendor payments" ON vendor_payments;
CREATE POLICY "Tenant members can update vendor payments"
  ON vendor_payments FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- DELETE policy
DROP POLICY IF EXISTS "Tenant members can delete vendor payments" ON vendor_payments;
CREATE POLICY "Tenant members can delete vendor payments"
  ON vendor_payments FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- TRIGGER FOR updated_at
-- ============================================

DROP TRIGGER IF EXISTS update_vendor_payments_updated_at ON vendor_payments;
CREATE TRIGGER update_vendor_payments_updated_at
  BEFORE UPDATE ON vendor_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION TO UPDATE PO PAYMENT STATUS
-- ============================================

CREATE OR REPLACE FUNCTION update_po_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid NUMERIC(12,2);
  v_po_total NUMERIC(12,2);
BEGIN
  -- Skip if no purchase_order_id
  IF COALESCE(NEW.purchase_order_id, OLD.purchase_order_id) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate total paid for this PO
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM vendor_payments
  WHERE purchase_order_id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);

  -- Get PO total
  SELECT total INTO v_po_total
  FROM purchase_orders
  WHERE id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);

  -- Update PO payment status
  UPDATE purchase_orders
  SET
    paid_amount = v_total_paid,
    payment_status = CASE
      WHEN v_total_paid >= v_po_total THEN 'paid'
      WHEN v_total_paid > 0 THEN 'partial'
      ELSE 'unpaid'
    END,
    payment_date = CASE
      WHEN v_total_paid >= v_po_total THEN CURRENT_DATE
      ELSE payment_date
    END
  WHERE id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for payment status updates
DROP TRIGGER IF EXISTS vendor_payment_insert_trigger ON vendor_payments;
CREATE TRIGGER vendor_payment_insert_trigger
  AFTER INSERT ON vendor_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_po_payment_status();

DROP TRIGGER IF EXISTS vendor_payment_update_trigger ON vendor_payments;
CREATE TRIGGER vendor_payment_update_trigger
  AFTER UPDATE ON vendor_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_po_payment_status();

DROP TRIGGER IF EXISTS vendor_payment_delete_trigger ON vendor_payments;
CREATE TRIGGER vendor_payment_delete_trigger
  AFTER DELETE ON vendor_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_po_payment_status();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE vendor_payments IS 'Tracks payments made to vendors for purchase orders';
COMMENT ON COLUMN vendor_payments.tenant_id IS 'Tenant owning this payment record';
COMMENT ON COLUMN vendor_payments.vendor_id IS 'Vendor receiving the payment';
COMMENT ON COLUMN vendor_payments.purchase_order_id IS 'Optional link to specific purchase order';
COMMENT ON COLUMN vendor_payments.amount IS 'Payment amount';
COMMENT ON COLUMN vendor_payments.payment_method IS 'Method of payment';
COMMENT ON COLUMN vendor_payments.reference_number IS 'Check number, wire ref, or other payment reference';

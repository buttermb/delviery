-- ============================================================================
-- BIG PLUG CRM - Additional Tables
-- Supplier transactions and enhanced financial tracking
-- ============================================================================

-- Supplier Transactions Table
CREATE TABLE IF NOT EXISTS supplier_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES wholesale_clients(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'payment', 'credit', 'debit')),
  amount NUMERIC(12,2) NOT NULL,
  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  notes TEXT,
  invoice_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add payment_due_date to wholesale_orders if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wholesale_orders' 
    AND column_name = 'payment_due_date'
  ) THEN
    ALTER TABLE wholesale_orders 
    ADD COLUMN payment_due_date TIMESTAMPTZ;
  END IF;
END $$;

-- Add payment_status to wholesale_orders if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wholesale_orders' 
    AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE wholesale_orders 
    ADD COLUMN payment_status TEXT DEFAULT 'unpaid' 
    CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overdue'));
  END IF;
END $$;

-- Add internal_notes to wholesale_orders if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wholesale_orders' 
    AND column_name = 'internal_notes'
  ) THEN
    ALTER TABLE wholesale_orders 
    ADD COLUMN internal_notes TEXT;
  END IF;
END $$;

-- Add collection_amount to wholesale_deliveries if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wholesale_deliveries' 
    AND column_name = 'collection_amount'
  ) THEN
    ALTER TABLE wholesale_deliveries 
    ADD COLUMN collection_amount NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;

-- Add scheduled_pickup_time to wholesale_deliveries if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wholesale_deliveries' 
    AND column_name = 'scheduled_pickup_time'
  ) THEN
    ALTER TABLE wholesale_deliveries 
    ADD COLUMN scheduled_pickup_time TIMESTAMPTZ;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_account_id ON supplier_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_supplier_id ON supplier_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_date ON supplier_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_payment_due ON wholesale_orders(payment_due_date);
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_payment_status ON wholesale_orders(payment_status);

-- RLS Policies
ALTER TABLE supplier_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view supplier transactions"
ON supplier_transactions FOR SELECT
TO authenticated
USING (
  account_id IN (
    SELECT id FROM accounts WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage supplier transactions"
ON supplier_transactions FOR ALL
TO authenticated
USING (
  account_id IN (
    SELECT id FROM accounts WHERE owner_id = auth.uid()
  )
);

COMMENT ON TABLE supplier_transactions IS 'Track payments to suppliers and credit in (what you owe)';
COMMENT ON COLUMN wholesale_orders.payment_due_date IS 'When payment is due for credit orders';
COMMENT ON COLUMN wholesale_deliveries.collection_amount IS 'Amount runner should collect from previous orders';


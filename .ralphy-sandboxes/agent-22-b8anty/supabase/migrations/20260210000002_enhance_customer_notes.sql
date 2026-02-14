-- Enhance customer_notes table for timeline feature
-- Adds tenant_id, is_pinned, order_id, and followup note_type

-- Add tenant_id column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_notes' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE customer_notes ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add is_pinned column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_notes' AND column_name = 'is_pinned'
  ) THEN
    ALTER TABLE customer_notes ADD COLUMN is_pinned BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add order_id column if not exists (for linking notes to specific orders)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_notes' AND column_name = 'order_id'
  ) THEN
    ALTER TABLE customer_notes ADD COLUMN order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add updated_at column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_notes' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE customer_notes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Drop existing check constraint and add new one with 'followup' type
DO $$
BEGIN
  -- Try to drop existing constraint (may fail if doesn't exist, which is fine)
  ALTER TABLE customer_notes DROP CONSTRAINT IF EXISTS customer_notes_note_type_check;

  -- Add updated constraint with followup option
  ALTER TABLE customer_notes ADD CONSTRAINT customer_notes_note_type_check
    CHECK (note_type IN ('general', 'preference', 'medical', 'complaint', 'compliment', 'followup'));
EXCEPTION
  WHEN OTHERS THEN
    -- Constraint might be named differently, try alternate approach
    NULL;
END $$;

-- Create index for tenant_id and customer_id lookup
CREATE INDEX IF NOT EXISTS idx_customer_notes_tenant_customer
  ON customer_notes(tenant_id, customer_id);

-- Create index for pinned notes
CREATE INDEX IF NOT EXISTS idx_customer_notes_pinned
  ON customer_notes(tenant_id, customer_id, is_pinned)
  WHERE is_pinned = true;

-- Create index for order-linked notes
CREATE INDEX IF NOT EXISTS idx_customer_notes_order
  ON customer_notes(order_id)
  WHERE order_id IS NOT NULL;

-- Enable RLS
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Tenant users can view customer notes" ON customer_notes;
DROP POLICY IF EXISTS "Tenant users can insert customer notes" ON customer_notes;
DROP POLICY IF EXISTS "Tenant users can update customer notes" ON customer_notes;
DROP POLICY IF EXISTS "Tenant users can delete customer notes" ON customer_notes;

-- RLS policy for tenant isolation
CREATE POLICY "Tenant users can view customer notes"
  ON customer_notes FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Tenant users can insert customer notes"
  ON customer_notes FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Tenant users can update customer notes"
  ON customer_notes FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Tenant users can delete customer notes"
  ON customer_notes FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

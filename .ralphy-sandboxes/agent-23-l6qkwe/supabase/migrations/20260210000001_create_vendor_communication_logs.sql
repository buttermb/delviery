-- ============================================================================
-- VENDOR COMMUNICATION LOGS
-- Tracks all communications with vendors (calls, emails, meetings, notes)
-- with optional PO attachment and searchable timeline view
-- ============================================================================

-- Create communication type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vendor_communication_type') THEN
    CREATE TYPE vendor_communication_type AS ENUM ('call', 'email', 'meeting', 'note', 'other');
  END IF;
END $$;

-- Create the vendor_communication_logs table
CREATE TABLE IF NOT EXISTS vendor_communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  -- Communication details
  communication_type vendor_communication_type NOT NULL DEFAULT 'note',
  subject TEXT,
  content TEXT NOT NULL,

  -- Optional PO attachment
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,

  -- Contact information (who was communicated with)
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,

  -- Staff who logged this
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,

  -- Metadata
  communication_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_communication_logs_tenant_id
  ON vendor_communication_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_communication_logs_vendor_id
  ON vendor_communication_logs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_communication_logs_type
  ON vendor_communication_logs(communication_type);
CREATE INDEX IF NOT EXISTS idx_vendor_communication_logs_date
  ON vendor_communication_logs(communication_date DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_communication_logs_po
  ON vendor_communication_logs(purchase_order_id) WHERE purchase_order_id IS NOT NULL;

-- Full-text search index for content and subject
CREATE INDEX IF NOT EXISTS idx_vendor_communication_logs_search
  ON vendor_communication_logs USING gin(to_tsvector('english', coalesce(subject, '') || ' ' || content));

-- Enable RLS
ALTER TABLE vendor_communication_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Tenant users can view their vendor communication logs" ON vendor_communication_logs;
CREATE POLICY "Tenant users can view their vendor communication logs"
  ON vendor_communication_logs FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant users can insert vendor communication logs" ON vendor_communication_logs;
CREATE POLICY "Tenant users can insert vendor communication logs"
  ON vendor_communication_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant users can update their vendor communication logs" ON vendor_communication_logs;
CREATE POLICY "Tenant users can update their vendor communication logs"
  ON vendor_communication_logs FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant users can delete their vendor communication logs" ON vendor_communication_logs;
CREATE POLICY "Tenant users can delete their vendor communication logs"
  ON vendor_communication_logs FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_vendor_communication_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vendor_communication_logs_updated_at ON vendor_communication_logs;
CREATE TRIGGER trigger_update_vendor_communication_logs_updated_at
  BEFORE UPDATE ON vendor_communication_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_communication_logs_updated_at();

-- Comments
COMMENT ON TABLE vendor_communication_logs IS 'Tracks all communications with vendors for team coordination';
COMMENT ON COLUMN vendor_communication_logs.communication_type IS 'Type of communication: call, email, meeting, note, other';
COMMENT ON COLUMN vendor_communication_logs.purchase_order_id IS 'Optional link to related purchase order';
COMMENT ON COLUMN vendor_communication_logs.communication_date IS 'When the communication occurred';

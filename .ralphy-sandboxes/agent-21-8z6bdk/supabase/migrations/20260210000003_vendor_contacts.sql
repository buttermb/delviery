-- ============================================
-- VENDOR CONTACTS MIGRATION
-- Adds vendor_contacts table for managing multiple contacts per vendor
-- Supports different departments: sales, billing, logistics, etc.
-- Primary contact auto-selected for PO communications
-- ============================================

-- Create vendor_contacts table
CREATE TABLE IF NOT EXISTS vendor_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  department TEXT CHECK (department IN ('sales', 'billing', 'logistics', 'support', 'management', 'other')),
  phone TEXT,
  email TEXT,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_tenant_id ON vendor_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_vendor_id ON vendor_contacts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_is_primary ON vendor_contacts(vendor_id, is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_created_at ON vendor_contacts(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

ALTER TABLE vendor_contacts ENABLE ROW LEVEL SECURITY;

-- SELECT policy
DROP POLICY IF EXISTS "Tenant members can view vendor contacts" ON vendor_contacts;
CREATE POLICY "Tenant members can view vendor contacts"
  ON vendor_contacts FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- INSERT policy
DROP POLICY IF EXISTS "Tenant members can insert vendor contacts" ON vendor_contacts;
CREATE POLICY "Tenant members can insert vendor contacts"
  ON vendor_contacts FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- UPDATE policy
DROP POLICY IF EXISTS "Tenant members can update vendor contacts" ON vendor_contacts;
CREATE POLICY "Tenant members can update vendor contacts"
  ON vendor_contacts FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- DELETE policy
DROP POLICY IF EXISTS "Tenant members can delete vendor contacts" ON vendor_contacts;
CREATE POLICY "Tenant members can delete vendor contacts"
  ON vendor_contacts FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- TRIGGER FOR updated_at
-- ============================================

DROP TRIGGER IF EXISTS update_vendor_contacts_updated_at ON vendor_contacts;
CREATE TRIGGER update_vendor_contacts_updated_at
  BEFORE UPDATE ON vendor_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION TO ENSURE ONLY ONE PRIMARY CONTACT
-- ============================================

CREATE OR REPLACE FUNCTION ensure_single_primary_vendor_contact()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this contact as primary, unset other primaries for this vendor
  IF NEW.is_primary = true THEN
    UPDATE vendor_contacts
    SET is_primary = false
    WHERE vendor_id = NEW.vendor_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for primary contact management
DROP TRIGGER IF EXISTS vendor_contact_primary_trigger ON vendor_contacts;
CREATE TRIGGER vendor_contact_primary_trigger
  BEFORE INSERT OR UPDATE ON vendor_contacts
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION ensure_single_primary_vendor_contact();

-- ============================================
-- CONTACT HISTORY LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS vendor_contact_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_contact_id UUID NOT NULL REFERENCES vendor_contacts(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('call', 'email', 'meeting', 'note')),
  summary TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for contact history
CREATE INDEX IF NOT EXISTS idx_vendor_contact_history_tenant_id ON vendor_contact_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_contact_history_contact_id ON vendor_contact_history(vendor_contact_id);
CREATE INDEX IF NOT EXISTS idx_vendor_contact_history_created_at ON vendor_contact_history(created_at DESC);

-- Enable RLS for contact history
ALTER TABLE vendor_contact_history ENABLE ROW LEVEL SECURITY;

-- SELECT policy for history
DROP POLICY IF EXISTS "Tenant members can view vendor contact history" ON vendor_contact_history;
CREATE POLICY "Tenant members can view vendor contact history"
  ON vendor_contact_history FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- INSERT policy for history
DROP POLICY IF EXISTS "Tenant members can insert vendor contact history" ON vendor_contact_history;
CREATE POLICY "Tenant members can insert vendor contact history"
  ON vendor_contact_history FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE vendor_contacts IS 'Stores multiple contacts per vendor with department assignments';
COMMENT ON COLUMN vendor_contacts.tenant_id IS 'Tenant owning this contact record';
COMMENT ON COLUMN vendor_contacts.vendor_id IS 'Vendor this contact belongs to';
COMMENT ON COLUMN vendor_contacts.name IS 'Contact full name';
COMMENT ON COLUMN vendor_contacts.role IS 'Job title or role (e.g., Account Manager, Billing Specialist)';
COMMENT ON COLUMN vendor_contacts.department IS 'Department for categorization (sales, billing, logistics, etc.)';
COMMENT ON COLUMN vendor_contacts.is_primary IS 'Primary contact for this vendor, auto-selected for PO communications';
COMMENT ON TABLE vendor_contact_history IS 'Log of interactions with vendor contacts';

-- ============================================================================
-- VENDOR DOCUMENTS
-- Upload and manage vendor documents including contracts, licenses, lab results,
-- certificates, and pricing sheets with expiration tracking
-- ============================================================================

-- Create document category enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vendor_document_category') THEN
    CREATE TYPE vendor_document_category AS ENUM (
      'contract',
      'license',
      'lab_result',
      'certificate',
      'pricing_sheet',
      'insurance',
      'other'
    );
  END IF;
END $$;

-- Create the vendor_documents table
CREATE TABLE IF NOT EXISTS vendor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  -- Document details
  category vendor_document_category NOT NULL DEFAULT 'other',
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,

  -- Expiration tracking
  expiration_date DATE,

  -- Additional information
  notes TEXT,

  -- Staff who uploaded this
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_name TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_documents_tenant_id
  ON vendor_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_documents_vendor_id
  ON vendor_documents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_documents_category
  ON vendor_documents(category);
CREATE INDEX IF NOT EXISTS idx_vendor_documents_expiration
  ON vendor_documents(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_documents_created
  ON vendor_documents(created_at DESC);

-- Full-text search index for name and notes
CREATE INDEX IF NOT EXISTS idx_vendor_documents_search
  ON vendor_documents USING gin(to_tsvector('english', name || ' ' || coalesce(notes, '')));

-- Enable RLS
ALTER TABLE vendor_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Tenant users can view their vendor documents" ON vendor_documents;
CREATE POLICY "Tenant users can view their vendor documents"
  ON vendor_documents FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant users can insert vendor documents" ON vendor_documents;
CREATE POLICY "Tenant users can insert vendor documents"
  ON vendor_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant users can update their vendor documents" ON vendor_documents;
CREATE POLICY "Tenant users can update their vendor documents"
  ON vendor_documents FOR UPDATE
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

DROP POLICY IF EXISTS "Tenant users can delete their vendor documents" ON vendor_documents;
CREATE POLICY "Tenant users can delete their vendor documents"
  ON vendor_documents FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_vendor_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vendor_documents_updated_at ON vendor_documents;
CREATE TRIGGER trigger_update_vendor_documents_updated_at
  BEFORE UPDATE ON vendor_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_documents_updated_at();

-- Comments
COMMENT ON TABLE vendor_documents IS 'Stores vendor documents like contracts, licenses, lab results, certificates, pricing sheets';
COMMENT ON COLUMN vendor_documents.category IS 'Document type: contract, license, lab_result, certificate, pricing_sheet, insurance, other';
COMMENT ON COLUMN vendor_documents.file_url IS 'URL to the document in Supabase Storage';
COMMENT ON COLUMN vendor_documents.expiration_date IS 'When the document expires (for licenses, certificates, etc.)';
COMMENT ON COLUMN vendor_documents.file_size IS 'File size in bytes';

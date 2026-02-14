-- FloraIQ Menu Migration System - Import Tracking Tables
-- This migration creates tables to track product imports from various sources

-- Create import status enum
DO $$ BEGIN
  CREATE TYPE import_status AS ENUM (
    'pending', 'processing', 'reviewing', 'completed', 'failed', 'rolled_back'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create import item status enum
DO $$ BEGIN
  CREATE TYPE import_item_status AS ENUM (
    'pending', 'parsed', 'validated', 'imported', 'skipped', 'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Product imports table - tracks each import session
CREATE TABLE IF NOT EXISTS product_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Import details
  filename TEXT,
  input_format TEXT NOT NULL,
  raw_data TEXT,
  
  -- Results
  total_rows INTEGER NOT NULL DEFAULT 0,
  successful_imports INTEGER DEFAULT 0,
  failed_imports INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,
  
  -- Status
  status import_status DEFAULT 'pending',
  error_log JSONB DEFAULT '[]',
  
  -- Metadata
  column_mapping JSONB,
  parsing_metadata JSONB,
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product import items - tracks individual rows within an import
CREATE TABLE IF NOT EXISTS product_import_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES product_imports(id) ON DELETE CASCADE,
  
  row_number INTEGER NOT NULL,
  raw_data JSONB NOT NULL,
  parsed_data JSONB,
  
  status import_item_status DEFAULT 'pending',
  product_id UUID REFERENCES wholesale_inventory(id),
  
  confidence_score DECIMAL(3,2),
  warnings JSONB DEFAULT '[]',
  errors JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for product_imports
CREATE INDEX IF NOT EXISTS idx_product_imports_tenant ON product_imports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_imports_status ON product_imports(status);
CREATE INDEX IF NOT EXISTS idx_product_imports_created_at ON product_imports(created_at DESC);

-- Indexes for product_import_items
CREATE INDEX IF NOT EXISTS idx_product_import_items_import ON product_import_items(import_id);
CREATE INDEX IF NOT EXISTS idx_product_import_items_status ON product_import_items(status);
CREATE INDEX IF NOT EXISTS idx_product_import_items_product ON product_import_items(product_id);

-- Enable RLS
ALTER TABLE product_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_import_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_imports
CREATE POLICY "Tenants can view their own imports"
  ON product_imports FOR SELECT
  USING (tenant_id IN (
    SELECT t.id FROM tenants t
    JOIN profiles p ON p.tenant_id = t.id
    WHERE p.id = auth.uid()
  ));

CREATE POLICY "Tenants can create their own imports"
  ON product_imports FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT t.id FROM tenants t
    JOIN profiles p ON p.tenant_id = t.id
    WHERE p.id = auth.uid()
  ));

CREATE POLICY "Tenants can update their own imports"
  ON product_imports FOR UPDATE
  USING (tenant_id IN (
    SELECT t.id FROM tenants t
    JOIN profiles p ON p.tenant_id = t.id
    WHERE p.id = auth.uid()
  ));

CREATE POLICY "Tenants can delete their own imports"
  ON product_imports FOR DELETE
  USING (tenant_id IN (
    SELECT t.id FROM tenants t
    JOIN profiles p ON p.tenant_id = t.id
    WHERE p.id = auth.uid()
  ));

-- RLS Policies for product_import_items
CREATE POLICY "Tenants can view their own import items"
  ON product_import_items FOR SELECT
  USING (import_id IN (
    SELECT pi.id FROM product_imports pi
    WHERE pi.tenant_id IN (
      SELECT t.id FROM tenants t
      JOIN profiles p ON p.tenant_id = t.id
      WHERE p.id = auth.uid()
    )
  ));

CREATE POLICY "Tenants can create their own import items"
  ON product_import_items FOR INSERT
  WITH CHECK (import_id IN (
    SELECT pi.id FROM product_imports pi
    WHERE pi.tenant_id IN (
      SELECT t.id FROM tenants t
      JOIN profiles p ON p.tenant_id = t.id
      WHERE p.id = auth.uid()
    )
  ));

CREATE POLICY "Tenants can update their own import items"
  ON product_import_items FOR UPDATE
  USING (import_id IN (
    SELECT pi.id FROM product_imports pi
    WHERE pi.tenant_id IN (
      SELECT t.id FROM tenants t
      JOIN profiles p ON p.tenant_id = t.id
      WHERE p.id = auth.uid()
    )
  ));

CREATE POLICY "Tenants can delete their own import items"
  ON product_import_items FOR DELETE
  USING (import_id IN (
    SELECT pi.id FROM product_imports pi
    WHERE pi.tenant_id IN (
      SELECT t.id FROM tenants t
      JOIN profiles p ON p.tenant_id = t.id
      WHERE p.id = auth.uid()
    )
  ));

-- Updated_at trigger for product_imports
CREATE OR REPLACE FUNCTION update_product_imports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_product_imports_updated_at ON product_imports;
CREATE TRIGGER trigger_product_imports_updated_at
  BEFORE UPDATE ON product_imports
  FOR EACH ROW
  EXECUTE FUNCTION update_product_imports_updated_at();

-- Grant permissions
GRANT ALL ON product_imports TO authenticated;
GRANT ALL ON product_import_items TO authenticated;





-- ============================================================================
-- CREATE MISSING TABLES: categories, warehouses, receiving_records
-- ============================================================================
-- Phase 1.1: Create tables required by admin pages
-- All tables include tenant_id for multi-tenant isolation
-- ============================================================================

-- ============================================================================
-- CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for categories
CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON public.categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON public.categories(name);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant-scoped access
DROP POLICY IF EXISTS "tenant_isolation_categories" ON public.categories;
CREATE POLICY "tenant_isolation_categories"
  ON public.categories
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE tenant_users.user_id = auth.uid()
      AND tenant_users.status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE tenant_users.user_id = auth.uid()
      AND tenant_users.status = 'active'
    )
  );

-- ============================================================================
-- WAREHOUSES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for warehouses
CREATE INDEX IF NOT EXISTS idx_warehouses_tenant_id ON public.warehouses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_manager_id ON public.warehouses(manager_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_name ON public.warehouses(name);

-- Enable RLS
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant-scoped access
DROP POLICY IF EXISTS "tenant_isolation_warehouses" ON public.warehouses;
CREATE POLICY "tenant_isolation_warehouses"
  ON public.warehouses
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE tenant_users.user_id = auth.uid()
      AND tenant_users.status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE tenant_users.user_id = auth.uid()
      AND tenant_users.status = 'active'
    )
  );

-- ============================================================================
-- RECEIVING_RECORDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.receiving_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shipment_number TEXT NOT NULL,
  vendor TEXT NOT NULL,
  received_date TIMESTAMPTZ DEFAULT NOW(),
  expected_items INTEGER,
  received_items INTEGER,
  damaged_items INTEGER DEFAULT 0,
  missing_items INTEGER DEFAULT 0,
  qc_status TEXT DEFAULT 'pending' CHECK (qc_status IN ('pending', 'passed', 'failed', 'quarantined')),
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for receiving_records
CREATE INDEX IF NOT EXISTS idx_receiving_records_tenant_id ON public.receiving_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receiving_records_shipment_number ON public.receiving_records(shipment_number);
CREATE INDEX IF NOT EXISTS idx_receiving_records_status ON public.receiving_records(status);
CREATE INDEX IF NOT EXISTS idx_receiving_records_qc_status ON public.receiving_records(qc_status);
CREATE INDEX IF NOT EXISTS idx_receiving_records_received_date ON public.receiving_records(received_date DESC);

-- Enable RLS
ALTER TABLE public.receiving_records ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant-scoped access
DROP POLICY IF EXISTS "tenant_isolation_receiving_records" ON public.receiving_records;
CREATE POLICY "tenant_isolation_receiving_records"
  ON public.receiving_records
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE tenant_users.user_id = auth.uid()
      AND tenant_users.status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE tenant_users.user_id = auth.uid()
      AND tenant_users.status = 'active'
    )
  );

-- Comments
COMMENT ON TABLE public.categories IS 'Product categories for organizing inventory';
COMMENT ON TABLE public.warehouses IS 'Warehouse locations for inventory management';
COMMENT ON TABLE public.receiving_records IS 'Records of incoming shipments and quality control';


-- ============================================================================
-- Migration Template
-- 
-- Copy this template when creating new database migrations.
-- Follows all established rules and best practices.
-- 
-- File: supabase/migrations/YYYYMMDDHHMMSS_description.sql
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE TABLE (if needed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.table_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- ✅ ALWAYS include tenant_id for multi-tenant tables
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- ✅ Reference public.profiles (NOT auth.users)
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  
  -- Your columns here
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT check_status CHECK (status IN ('active', 'inactive', 'archived'))
);

-- ============================================================================
-- STEP 2: CREATE INDEXES
-- ============================================================================
-- ✅ Index on tenant_id (for multi-tenant tables)
CREATE INDEX IF NOT EXISTS idx_table_name_tenant_id ON public.table_name(tenant_id);

-- ✅ Index on foreign keys
CREATE INDEX IF NOT EXISTS idx_table_name_user_id ON public.table_name(user_id);

-- ✅ Index on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_table_name_status ON public.table_name(status);
CREATE INDEX IF NOT EXISTS idx_table_name_created_at ON public.table_name(created_at);

-- ============================================================================
-- STEP 3: ENABLE RLS
-- ============================================================================
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: CREATE RLS POLICIES
-- ============================================================================

-- Tenant isolation policy (for multi-tenant tables)
DROP POLICY IF EXISTS "Tenant isolation for table_name" ON public.table_name;
CREATE POLICY "Tenant isolation for table_name"
  ON public.table_name FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.tenant_users 
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.tenant_users 
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Optional: User owns record policy
-- DROP POLICY IF EXISTS "Users can view own records" ON public.table_name;
-- CREATE POLICY "Users can view own records"
--   ON public.table_name FOR SELECT
--   USING (user_id = auth.uid());

-- ============================================================================
-- STEP 5: CREATE TRIGGERS (if needed)
-- ============================================================================

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_table_name_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_table_name_updated_at_trigger ON public.table_name;
CREATE TRIGGER update_table_name_updated_at_trigger
  BEFORE UPDATE ON public.table_name
  FOR EACH ROW
  EXECUTE FUNCTION update_table_name_updated_at();

-- ============================================================================
-- STEP 6: CREATE HELPER FUNCTIONS (if needed)
-- ============================================================================

-- ✅ ALWAYS include SET search_path = public for SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.get_table_name_count(_tenant_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public  -- ⚠️ REQUIRED!
AS $$
  SELECT COUNT(*)
  FROM public.table_name
  WHERE tenant_id = _tenant_id;
$$;

-- ============================================================================
-- STEP 7: COMMENTS (optional but recommended)
-- ============================================================================
COMMENT ON TABLE public.table_name IS 'Description of what this table stores';
COMMENT ON COLUMN public.table_name.tenant_id IS 'Foreign key to tenants table for multi-tenant isolation';


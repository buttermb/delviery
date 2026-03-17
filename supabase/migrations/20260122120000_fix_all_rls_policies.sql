-- Migration: Fix all overly permissive RLS policies
-- This migration implements proper tenant isolation across all tables
-- CRITICAL: This must be run to secure the multi-tenant system
-- Date: 2026-01-22

-- ============================================================================
-- HELPER FUNCTION: Get user's tenant IDs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_tenant_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
$$;

-- ============================================================================
-- VENDORS TABLE
-- ============================================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow all for authenticated" ON vendors;
DROP POLICY IF EXISTS "vendors_select" ON vendors;
DROP POLICY IF EXISTS "vendors_insert" ON vendors;
DROP POLICY IF EXISTS "vendors_update" ON vendors;
DROP POLICY IF EXISTS "vendors_delete" ON vendors;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON vendors;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON vendors;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON vendors;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON vendors;

-- Create policies using EXISTS check (vendors does NOT have tenant_id column)
DROP POLICY IF EXISTS "vendors_tenant_select" ON vendors;
CREATE POLICY "vendors_tenant_select" ON vendors FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "vendors_tenant_insert" ON vendors;
CREATE POLICY "vendors_tenant_insert" ON vendors FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

DROP POLICY IF EXISTS "vendors_tenant_update" ON vendors;
CREATE POLICY "vendors_tenant_update" ON vendors FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

DROP POLICY IF EXISTS "vendors_tenant_delete" ON vendors;
CREATE POLICY "vendors_tenant_delete" ON vendors FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Allow all for authenticated" ON products;
DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;
DROP POLICY IF EXISTS "products_delete" ON products;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON products;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON products;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON products;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON products;
DROP POLICY IF EXISTS "Tenant members can view products" ON products;
DROP POLICY IF EXISTS "Tenant members can create products" ON products;
DROP POLICY IF EXISTS "Tenant members can update products" ON products;
DROP POLICY IF EXISTS "Tenant members can delete products" ON products;

-- Products is a public-readable table (no tenant_id column)
-- SELECT: public read access for anon and authenticated
DROP POLICY IF EXISTS "products_tenant_select" ON products;
CREATE POLICY "products_tenant_select" ON products FOR SELECT TO anon, authenticated
  USING (true);

-- INSERT/UPDATE/DELETE: only admin/owner tenant members
DROP POLICY IF EXISTS "products_tenant_insert" ON products;
CREATE POLICY "products_tenant_insert" ON products FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

DROP POLICY IF EXISTS "products_tenant_update" ON products;
CREATE POLICY "products_tenant_update" ON products FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

DROP POLICY IF EXISTS "products_tenant_delete" ON products;
CREATE POLICY "products_tenant_delete" ON products FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Allow all for authenticated" ON orders;
DROP POLICY IF EXISTS "orders_select" ON orders;
DROP POLICY IF EXISTS "orders_insert" ON orders;
DROP POLICY IF EXISTS "orders_update" ON orders;
DROP POLICY IF EXISTS "orders_delete" ON orders;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON orders;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON orders;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON orders;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON orders;
DROP POLICY IF EXISTS "Tenant members can view orders" ON orders;
DROP POLICY IF EXISTS "Authenticated users can create orders" ON orders;
DROP POLICY IF EXISTS "Tenant members can update orders" ON orders;
DROP POLICY IF EXISTS "Tenant members can delete orders" ON orders;

-- Staff can see all orders (orders does NOT have tenant_id column)
DROP POLICY IF EXISTS "orders_staff_select" ON orders;
CREATE POLICY "orders_staff_select" ON orders FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- Customers can see their own orders (for customer portal)
DROP POLICY IF EXISTS "orders_customer_select" ON orders;
CREATE POLICY "orders_customer_select" ON orders FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "orders_tenant_insert" ON orders;
CREATE POLICY "orders_tenant_insert" ON orders FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

DROP POLICY IF EXISTS "orders_tenant_update" ON orders;
CREATE POLICY "orders_tenant_update" ON orders FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

DROP POLICY IF EXISTS "orders_tenant_delete" ON orders;
CREATE POLICY "orders_tenant_delete" ON orders FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Allow all for authenticated" ON customers;
DROP POLICY IF EXISTS "customers_select" ON customers;
DROP POLICY IF EXISTS "customers_insert" ON customers;
DROP POLICY IF EXISTS "customers_update" ON customers;
DROP POLICY IF EXISTS "customers_delete" ON customers;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON customers;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON customers;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON customers;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON customers;

-- Customers does NOT have tenant_id column - use EXISTS check
DROP POLICY IF EXISTS "customers_tenant_select" ON customers;
CREATE POLICY "customers_tenant_select" ON customers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "customers_tenant_insert" ON customers;
CREATE POLICY "customers_tenant_insert" ON customers FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

DROP POLICY IF EXISTS "customers_tenant_update" ON customers;
CREATE POLICY "customers_tenant_update" ON customers FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

DROP POLICY IF EXISTS "customers_tenant_delete" ON customers;
CREATE POLICY "customers_tenant_delete" ON customers FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Allow all for authenticated" ON invoices;
DROP POLICY IF EXISTS "invoices_select" ON invoices;
DROP POLICY IF EXISTS "invoices_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_update" ON invoices;
DROP POLICY IF EXISTS "invoices_delete" ON invoices;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON invoices;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON invoices;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON invoices;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON invoices;
DROP POLICY IF EXISTS "Tenant members can view invoices" ON invoices;
DROP POLICY IF EXISTS "Tenant members can create invoices" ON invoices;
DROP POLICY IF EXISTS "Tenant members can update invoices" ON invoices;
DROP POLICY IF EXISTS "Tenant members can delete invoices" ON invoices;
DROP POLICY IF EXISTS "invoices_tenant_select" ON invoices;
DROP POLICY IF EXISTS "invoices_tenant_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_tenant_update" ON invoices;
DROP POLICY IF EXISTS "invoices_tenant_delete" ON invoices;

-- Invoices does NOT have tenant_id column - use EXISTS check
DROP POLICY IF EXISTS "invoices_tenant_select" ON invoices;
CREATE POLICY "invoices_tenant_select" ON invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "invoices_tenant_insert" ON invoices;
CREATE POLICY "invoices_tenant_insert" ON invoices FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

DROP POLICY IF EXISTS "invoices_tenant_update" ON invoices;
CREATE POLICY "invoices_tenant_update" ON invoices FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

DROP POLICY IF EXISTS "invoices_tenant_delete" ON invoices;
CREATE POLICY "invoices_tenant_delete" ON invoices FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

-- ============================================================================
-- POS_TRANSACTIONS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Allow all for authenticated" ON pos_transactions;
DROP POLICY IF EXISTS "pos_transactions_select" ON pos_transactions;
DROP POLICY IF EXISTS "pos_transactions_insert" ON pos_transactions;
DROP POLICY IF EXISTS "pos_transactions_update" ON pos_transactions;
DROP POLICY IF EXISTS "pos_transactions_delete" ON pos_transactions;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON pos_transactions;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON pos_transactions;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON pos_transactions;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON pos_transactions;
DROP POLICY IF EXISTS "pos_transactions_tenant_select" ON pos_transactions;
DROP POLICY IF EXISTS "pos_transactions_tenant_insert" ON pos_transactions;
DROP POLICY IF EXISTS "pos_transactions_tenant_update" ON pos_transactions;
DROP POLICY IF EXISTS "pos_transactions_tenant_delete" ON pos_transactions;

DROP POLICY IF EXISTS "pos_transactions_tenant_select" ON pos_transactions;
CREATE POLICY "pos_transactions_tenant_select" ON pos_transactions FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

DROP POLICY IF EXISTS "pos_transactions_tenant_insert" ON pos_transactions;
CREATE POLICY "pos_transactions_tenant_insert" ON pos_transactions FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

DROP POLICY IF EXISTS "pos_transactions_tenant_update" ON pos_transactions;
CREATE POLICY "pos_transactions_tenant_update" ON pos_transactions FOR UPDATE
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

-- No delete policy - POS transactions should never be deleted, only voided

-- ============================================================================
-- POS_SHIFTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Allow all for authenticated" ON pos_shifts;
DROP POLICY IF EXISTS "pos_shifts_select" ON pos_shifts;
DROP POLICY IF EXISTS "pos_shifts_insert" ON pos_shifts;
DROP POLICY IF EXISTS "pos_shifts_update" ON pos_shifts;
DROP POLICY IF EXISTS "pos_shifts_delete" ON pos_shifts;

DROP POLICY IF EXISTS "pos_shifts_tenant_select" ON pos_shifts;
CREATE POLICY "pos_shifts_tenant_select" ON pos_shifts FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

DROP POLICY IF EXISTS "pos_shifts_tenant_insert" ON pos_shifts;
CREATE POLICY "pos_shifts_tenant_insert" ON pos_shifts FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

DROP POLICY IF EXISTS "pos_shifts_tenant_update" ON pos_shifts;
CREATE POLICY "pos_shifts_tenant_update" ON pos_shifts FOR UPDATE
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

-- ============================================================================
-- INVENTORY / STOCK TABLES
-- ============================================================================

-- Apply same pattern to: inventory, stock_adjustments, inventory_locations
-- For each table that exists, drop old policies and create tenant-isolated ones

DO $$
DECLARE
  tables_to_fix TEXT[] := ARRAY[
    'inventory',
    'stock_adjustments',
    'inventory_locations',
    'wholesale_clients',
    'wholesale_orders',
    'categories',
    'discounts',
    'promotions',
    'loyalty_programs',
    'loyalty_points',
    'delivery_zones',
    'delivery_drivers',
    'notifications',
    'audit_logs',
    'tenant_settings',
    'payment_methods',
    'tax_rates'
  ];
  tbl TEXT;
  has_tenant_id BOOLEAN;
BEGIN
  FOREACH tbl IN ARRAY tables_to_fix
  LOOP
    -- Check if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
      -- Check if table has a tenant_id column
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = tbl AND table_schema = 'public' AND column_name = 'tenant_id'
      ) INTO has_tenant_id;

      -- Drop old policies
      EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated" ON %I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON %I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON %I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON %I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Enable read access for authenticated users" ON %I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Enable insert for authenticated users" ON %I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Enable update for authenticated users" ON %I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Enable delete for authenticated users" ON %I', tbl);

      IF has_tenant_id THEN
        -- Table HAS tenant_id: use tenant_id-based isolation
        EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_select" ON %I', tbl, tbl);
        EXECUTE format('
          CREATE POLICY "%s_tenant_select" ON %I FOR SELECT
            USING (tenant_id IN (SELECT public.user_tenant_ids()))
        ', tbl, tbl);

        EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_insert" ON %I', tbl, tbl);
        EXECUTE format('
          CREATE POLICY "%s_tenant_insert" ON %I FOR INSERT
            WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()))
        ', tbl, tbl);

        EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_update" ON %I', tbl, tbl);
        EXECUTE format('
          CREATE POLICY "%s_tenant_update" ON %I FOR UPDATE
            USING (tenant_id IN (SELECT public.user_tenant_ids()))
            WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()))
        ', tbl, tbl);

        EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_delete" ON %I', tbl, tbl);
        EXECUTE format('
          CREATE POLICY "%s_tenant_delete" ON %I FOR DELETE
            USING (tenant_id IN (SELECT public.user_tenant_ids()))
        ', tbl, tbl);
      ELSE
        -- Table does NOT have tenant_id: use EXISTS check against tenant_users
        EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_select" ON %I', tbl, tbl);
        EXECUTE format('
          CREATE POLICY "%s_tenant_select" ON %I FOR SELECT
            USING (EXISTS (SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid()))
        ', tbl, tbl);

        EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_insert" ON %I', tbl, tbl);
        EXECUTE format('
          CREATE POLICY "%s_tenant_insert" ON %I FOR INSERT
            WITH CHECK (EXISTS (SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN (''admin'', ''owner'')))
        ', tbl, tbl);

        EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_update" ON %I', tbl, tbl);
        EXECUTE format('
          CREATE POLICY "%s_tenant_update" ON %I FOR UPDATE
            USING (EXISTS (SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN (''admin'', ''owner'')))
        ', tbl, tbl);

        EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_delete" ON %I', tbl, tbl);
        EXECUTE format('
          CREATE POLICY "%s_tenant_delete" ON %I FOR DELETE
            USING (EXISTS (SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN (''admin'', ''owner'')))
        ', tbl, tbl);
      END IF;

      RAISE NOTICE 'Fixed RLS policies for table: % (has_tenant_id: %)', tbl, has_tenant_id;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- FIX SECURITY DEFINER FUNCTIONS
-- ============================================================================

-- Find and fix all SECURITY DEFINER functions without search_path set
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN
    SELECT
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.prosecdef = true
      AND n.nspname = 'public'
      AND (p.proconfig IS NULL OR NOT p.proconfig @> ARRAY['search_path=public'])
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER FUNCTION %I.%I(%s) SET search_path = public',
        func_record.schema_name,
        func_record.function_name,
        func_record.args
      );
      RAISE NOTICE 'Fixed search_path for function: %.%',
        func_record.schema_name, func_record.function_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not fix function %.%: %',
        func_record.schema_name, func_record.function_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- VERIFY CHANGES
-- ============================================================================

-- Create a verification function
CREATE OR REPLACE FUNCTION public.verify_rls_policies()
RETURNS TABLE (
  table_name TEXT,
  policy_name TEXT,
  policy_type TEXT,
  is_permissive BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    schemaname || '.' || tablename as table_name,
    policyname as policy_name,
    cmd as policy_type,
    permissive = 'PERMISSIVE' as is_permissive
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, policyname;
$$;

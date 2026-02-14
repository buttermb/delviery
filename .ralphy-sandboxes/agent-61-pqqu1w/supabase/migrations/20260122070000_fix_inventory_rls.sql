-- ============================================================================
-- Fix overly permissive RLS policies on inventory table
--
-- Problem: Current policies allow any authenticated user to view all inventory
-- ("Authenticated users can view inventory stock" with USING (auth.uid() IS NOT NULL))
-- and use inconsistent merchant email checks for management.
--
-- Solution: Use tenant_users table directly for tenant membership checks,
-- consistent with products, vendors, orders, and other tables in the system.
-- ============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Inventory viewable by everyone" ON inventory;
DROP POLICY IF EXISTS "Merchants can manage own inventory" ON inventory;
DROP POLICY IF EXISTS "Authenticated users can view inventory stock" ON inventory;
DROP POLICY IF EXISTS "Merchants can view own inventory details" ON inventory;
DROP POLICY IF EXISTS "tenant_isolation_inventory" ON inventory;
DROP POLICY IF EXISTS "inventory_tenant_select" ON inventory;
DROP POLICY IF EXISTS "inventory_tenant_insert" ON inventory;
DROP POLICY IF EXISTS "inventory_tenant_update" ON inventory;
DROP POLICY IF EXISTS "inventory_tenant_delete" ON inventory;

-- Ensure tenant_id column exists
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Ensure index exists for performance
CREATE INDEX IF NOT EXISTS idx_inventory_tenant_id ON inventory(tenant_id);

-- Ensure RLS is enabled
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Create tenant-isolated policies using tenant_users table
-- This is consistent with products, vendors, orders, and other tables

-- SELECT: Allow authenticated users who belong to the tenant
CREATE POLICY "inventory_tenant_select" ON inventory FOR SELECT
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- INSERT: Only tenant members can insert inventory for their tenant
CREATE POLICY "inventory_tenant_insert" ON inventory FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- UPDATE: Only tenant members can update inventory for their tenant
CREATE POLICY "inventory_tenant_update" ON inventory FOR UPDATE
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- DELETE: Only tenant members can delete inventory for their tenant
CREATE POLICY "inventory_tenant_delete" ON inventory FOR DELETE
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- ============================================================================
-- VERIFICATION QUERIES (Run these after migration to verify)
-- ============================================================================
-- Check policies exist:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'inventory';
--
-- Expected result:
-- | policyname              | cmd    |
-- |-------------------------|--------|
-- | inventory_tenant_select | SELECT |
-- | inventory_tenant_insert | INSERT |
-- | inventory_tenant_update | UPDATE |
-- | inventory_tenant_delete | DELETE |
-- ============================================================================

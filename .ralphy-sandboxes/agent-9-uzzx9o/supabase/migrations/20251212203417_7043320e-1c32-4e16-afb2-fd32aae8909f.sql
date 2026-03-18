-- Add tenant_id column to fronted_inventory for direct tenant filtering
ALTER TABLE fronted_inventory ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);

-- Backfill tenant_id from accounts table
UPDATE fronted_inventory fi
SET tenant_id = a.tenant_id
FROM accounts a
WHERE fi.account_id = a.id AND fi.tenant_id IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_fronted_inventory_tenant_id ON fronted_inventory(tenant_id);

-- Drop existing overly complex policies
DROP POLICY IF EXISTS "Users can view fronted inventory for their account" ON fronted_inventory;
DROP POLICY IF EXISTS "Users can insert fronted inventory for their account" ON fronted_inventory;
DROP POLICY IF EXISTS "Users can update fronted inventory for their account" ON fronted_inventory;

-- Add simpler tenant-based RLS policies
CREATE POLICY "Tenant users can view fronted inventory"
ON fronted_inventory FOR SELECT
USING (
  tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid()))
);

CREATE POLICY "Tenant users can insert fronted inventory"
ON fronted_inventory FOR INSERT
WITH CHECK (
  tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid()))
);

CREATE POLICY "Tenant users can update fronted inventory"
ON fronted_inventory FOR UPDATE
USING (
  tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid()))
);

CREATE POLICY "Tenant users can delete fronted inventory"
ON fronted_inventory FOR DELETE
USING (
  tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid()))
);
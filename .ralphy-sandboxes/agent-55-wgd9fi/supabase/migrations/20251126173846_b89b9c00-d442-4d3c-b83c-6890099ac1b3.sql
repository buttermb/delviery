-- ============================================================================
-- FIX RLS POLICIES FOR TENANT ISOLATION
-- ============================================================================
-- Problem: Multiple conflicting policies, some using profiles.account_id (NULL)
-- Solution: Consolidate to single set using tenant_users table
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FIX: pos_transactions table
-- ----------------------------------------------------------------------------

-- Drop all conflicting policies
DROP POLICY IF EXISTS "Tenant admins can insert their POS transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Users can create transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Users can insert transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Users can view transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Users can update transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Users can delete transactions" ON pos_transactions;

-- Create clean, consistent policies using tenant_users
CREATE POLICY "Tenant members can insert POS transactions"
ON pos_transactions FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Tenant members can view POS transactions"
ON pos_transactions FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Tenant members can update POS transactions"
ON pos_transactions FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- 2. ADD PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------

-- Speed up tenant_users lookups (used in every RLS check)
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_tenant 
ON tenant_users(user_id, tenant_id);

-- Speed up tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_pos_transactions_tenant_date 
ON pos_transactions(tenant_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- VERIFICATION QUERIES
-- Run these after migration to verify:
-- 
-- 1. Check your tenant membership:
--    SELECT * FROM tenant_users WHERE user_id = auth.uid();
-- 
-- 2. Test pos_transactions access:
--    SELECT COUNT(*) FROM pos_transactions;
-- 
-- 3. Test insert (should work now):
--    INSERT INTO pos_transactions (tenant_id, ...) VALUES (...);
-- ----------------------------------------------------------------------------
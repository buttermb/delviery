-- Fix pos_transactions RLS policy to use tenant_users instead of profiles.account_id
-- This allows POS transactions to work when user has no account_id in profiles

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can create their own transactions" ON pos_transactions;

-- Create new INSERT policy using tenant_users
CREATE POLICY "Users can create transactions for their tenant"
ON pos_transactions
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
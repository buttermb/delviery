-- Fix overly permissive RLS policies for crm_invoices and fronted_inventory
-- This migration restricts access to sensitive financial data

-- ============================================
-- 1. Fix crm_invoices RLS Policy
-- The current "Anyone can view invoices by public token" policy uses USING(true)
-- which exposes ALL invoices. It should only allow access via valid public_token.
-- ============================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view invoices by public token" ON public.crm_invoices;

-- Create a properly restricted policy that requires a public_token parameter
-- Invoices can only be viewed publicly if accessed with the correct public_token
-- This is done via RPC or query parameter, not blanket access
CREATE POLICY "Public invoice access requires valid token"
ON public.crm_invoices FOR SELECT
TO anon, authenticated
USING (
  -- Only allow access if the request includes a matching public_token
  -- This prevents enumeration of all invoices
  public_token IS NOT NULL AND public_token = current_setting('request.headers', true)::json->>'x-invoice-token'
);

-- Add a service role bypass for admin operations
CREATE POLICY "Service role full access to crm_invoices"
ON public.crm_invoices FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 2. Fix fronted_inventory RLS Policies  
-- A later migration (20251031030500) created USING(true) policies
-- that override the proper tenant-scoped policies
-- ============================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Users can view their account fronted inventory" ON public.fronted_inventory;
DROP POLICY IF EXISTS "Users can insert their account fronted inventory" ON public.fronted_inventory;
DROP POLICY IF EXISTS "Users can update their account fronted inventory" ON public.fronted_inventory;

-- Recreate with proper tenant isolation using tenant_users table
CREATE POLICY "Tenant members can view fronted inventory"
ON public.fronted_inventory FOR SELECT
TO authenticated
USING (
  account_id IN (
    SELECT a.id FROM accounts a
    JOIN tenant_users tu ON tu.tenant_id = a.tenant_id
    WHERE tu.user_id = auth.uid()
  )
);

CREATE POLICY "Tenant members can insert fronted inventory"
ON public.fronted_inventory FOR INSERT
TO authenticated
WITH CHECK (
  account_id IN (
    SELECT a.id FROM accounts a
    JOIN tenant_users tu ON tu.tenant_id = a.tenant_id
    WHERE tu.user_id = auth.uid()
  )
);

CREATE POLICY "Tenant members can update fronted inventory"
ON public.fronted_inventory FOR UPDATE
TO authenticated
USING (
  account_id IN (
    SELECT a.id FROM accounts a
    JOIN tenant_users tu ON tu.tenant_id = a.tenant_id
    WHERE tu.user_id = auth.uid()
  )
);

CREATE POLICY "Tenant members can delete fronted inventory"
ON public.fronted_inventory FOR DELETE
TO authenticated
USING (
  account_id IN (
    SELECT a.id FROM accounts a
    JOIN tenant_users tu ON tu.tenant_id = a.tenant_id
    WHERE tu.user_id = auth.uid()
  )
);

-- Add service role bypass
CREATE POLICY "Service role full access to fronted_inventory"
ON public.fronted_inventory FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
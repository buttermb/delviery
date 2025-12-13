-- Fix RLS policies for pos_shifts to use safe helper functions
DROP POLICY IF EXISTS "Tenant admins can view their shifts" ON pos_shifts;
DROP POLICY IF EXISTS "Tenant admins can manage their shifts" ON pos_shifts;

CREATE POLICY "Tenant members can view their shifts"
  ON pos_shifts FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

CREATE POLICY "Tenant members can insert shifts"
  ON pos_shifts FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

CREATE POLICY "Tenant members can update shifts"
  ON pos_shifts FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

CREATE POLICY "Tenant members can delete shifts"
  ON pos_shifts FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

-- Fix RLS policies for pos_cash_drawer_events to use safe helper functions
DROP POLICY IF EXISTS "Tenant admins can view their cash drawer events" ON pos_cash_drawer_events;
DROP POLICY IF EXISTS "Tenant admins can manage their cash drawer events" ON pos_cash_drawer_events;

CREATE POLICY "Tenant members can view cash drawer events"
  ON pos_cash_drawer_events FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

CREATE POLICY "Tenant members can insert cash drawer events"
  ON pos_cash_drawer_events FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

CREATE POLICY "Tenant members can update cash drawer events"
  ON pos_cash_drawer_events FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

-- Fix remaining old-pattern policies for pos_transactions
DROP POLICY IF EXISTS "Tenant admins can view their POS transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Tenant admins can update their POS transactions" ON pos_transactions;
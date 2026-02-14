
-- Fix RLS policies for account_settings to allow tenant admins to manage their integration settings

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their account settings" ON account_settings;
DROP POLICY IF EXISTS "Users can update their account settings" ON account_settings;
DROP POLICY IF EXISTS "Users can insert their account settings" ON account_settings;
DROP POLICY IF EXISTS "Super admins have full access to account_settings" ON account_settings;

-- Create comprehensive RLS policies for account_settings
CREATE POLICY "Tenant admins can view their account settings"
  ON account_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = account_settings.account_id
        AND tenant_users.user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Tenant admins can insert their account settings"
  ON account_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = account_settings.account_id
        AND tenant_users.user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Tenant admins can update their account settings"
  ON account_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = account_settings.account_id
        AND tenant_users.user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = account_settings.account_id
        AND tenant_users.user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'super_admin')
  );

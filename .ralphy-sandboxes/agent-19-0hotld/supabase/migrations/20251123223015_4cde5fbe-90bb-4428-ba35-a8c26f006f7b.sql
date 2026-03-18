-- Fix account_settings RLS policies to use correct joins
-- Drop broken policies that compare tenant_id with account_id incorrectly
DROP POLICY IF EXISTS "Tenant admins can insert their account settings" ON account_settings;
DROP POLICY IF EXISTS "Tenant admins can update their account settings" ON account_settings;
DROP POLICY IF EXISTS "Tenant admins can view their account settings" ON account_settings;

-- SELECT policy: Allow viewing settings for accounts belonging to user's tenant
CREATE POLICY "Tenant members can view their account settings"
ON account_settings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM tenant_users tu
    JOIN accounts a ON a.tenant_id = tu.tenant_id
    WHERE a.id = account_settings.account_id
      AND tu.user_id = auth.uid()
      AND tu.status = 'active'
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- INSERT policy: Allow inserting settings for accounts belonging to user's tenant (admin/owner only)
CREATE POLICY "Tenant managers can insert account settings"
ON account_settings FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM tenant_users tu
    JOIN accounts a ON a.tenant_id = tu.tenant_id
    JOIN user_roles ur ON ur.user_id = tu.user_id
    WHERE a.id = account_settings.account_id
      AND tu.user_id = auth.uid()
      AND tu.status = 'active'
      AND ur.role IN ('owner'::app_role, 'admin'::app_role)
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- UPDATE policy: Allow updating settings for accounts belonging to user's tenant (admin/owner only)
CREATE POLICY "Tenant managers can update account settings"
ON account_settings FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM tenant_users tu
    JOIN accounts a ON a.tenant_id = tu.tenant_id
    JOIN user_roles ur ON ur.user_id = tu.user_id
    WHERE a.id = account_settings.account_id
      AND tu.user_id = auth.uid()
      AND tu.status = 'active'
      AND ur.role IN ('owner'::app_role, 'admin'::app_role)
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM tenant_users tu
    JOIN accounts a ON a.tenant_id = tu.tenant_id
    JOIN user_roles ur ON ur.user_id = tu.user_id
    WHERE a.id = account_settings.account_id
      AND tu.user_id = auth.uid()
      AND tu.status = 'active'
      AND ur.role IN ('owner'::app_role, 'admin'::app_role)
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
);
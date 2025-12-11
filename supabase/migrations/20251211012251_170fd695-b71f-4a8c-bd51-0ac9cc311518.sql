-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "tenants_select_member" ON tenants;
DROP POLICY IF EXISTS "tenants_update_admin" ON tenants;
DROP POLICY IF EXISTS "tenants_select_by_slug" ON tenants;

-- Create simplified tenants policies
CREATE POLICY "tenants_select_member" ON tenants
  FOR SELECT USING (
    is_tenant_member_safe(auth.uid(), id) OR
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid() AND admin_users.role = 'super_admin' AND admin_users.is_active = true)
  );

CREATE POLICY "tenants_update_admin" ON tenants
  FOR UPDATE USING (is_tenant_admin_safe(auth.uid(), id));

-- Allow anyone to view active tenants by slug for login lookup
CREATE POLICY "tenants_select_by_slug" ON tenants
  FOR SELECT USING (status = 'active');
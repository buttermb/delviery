-- =============================================
-- COMPREHENSIVE SECURITY LOCKDOWN (CORRECTED)
-- Using correct column names for each table
-- =============================================

-- 1. VENDORS TABLE - Uses account_id, not tenant_id
DROP POLICY IF EXISTS "Tenant members can view their vendors" ON vendors;
DROP POLICY IF EXISTS "Tenant members can insert vendors" ON vendors;
DROP POLICY IF EXISTS "Tenant members can update vendors" ON vendors;
DROP POLICY IF EXISTS "Tenant members can delete vendors" ON vendors;
DROP POLICY IF EXISTS "Tenant members can manage vendors" ON vendors;

CREATE POLICY "Account members can view their vendors"
  ON vendors FOR SELECT
  USING (
    account_id IN (SELECT id FROM accounts WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND status = 'active'))
    OR auth.uid() IN (SELECT user_id FROM admin_users WHERE role = 'super_admin' AND is_active = true)
  );

CREATE POLICY "Account members can insert vendors"
  ON vendors FOR INSERT
  WITH CHECK (
    account_id IN (SELECT id FROM accounts WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND status = 'active'))
  );

CREATE POLICY "Account members can update vendors"
  ON vendors FOR UPDATE
  USING (
    account_id IN (SELECT id FROM accounts WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND status = 'active'))
  );

CREATE POLICY "Account members can delete vendors"
  ON vendors FOR DELETE
  USING (
    account_id IN (SELECT id FROM accounts WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND status = 'active'))
  );

-- 2. SYSTEM_METRICS TABLE - No tenant_id, super admins only
DROP POLICY IF EXISTS "Super admins can view system metrics" ON system_metrics;
DROP POLICY IF EXISTS "System can insert metrics" ON system_metrics;

CREATE POLICY "Super admins can view system metrics"
  ON system_metrics FOR SELECT
  USING (
    auth.uid() IN (SELECT user_id FROM admin_users WHERE role = 'super_admin' AND is_active = true)
  );

CREATE POLICY "System can insert metrics"
  ON system_metrics FOR INSERT
  WITH CHECK (true);

-- 3. CREDIT_COSTS TABLE - No tenant_id, global config
DROP POLICY IF EXISTS "Authenticated users can view credit costs" ON credit_costs;
DROP POLICY IF EXISTS "Only admins can modify credit costs" ON credit_costs;
DROP POLICY IF EXISTS "Only admins can update credit costs" ON credit_costs;
DROP POLICY IF EXISTS "Only admins can delete credit costs" ON credit_costs;

CREATE POLICY "Authenticated users can view credit costs"
  ON credit_costs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins can insert credit costs"
  ON credit_costs FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM admin_users WHERE is_active = true)
  );

CREATE POLICY "Only admins can update credit costs"
  ON credit_costs FOR UPDATE
  USING (
    auth.uid() IN (SELECT user_id FROM admin_users WHERE is_active = true)
  );

CREATE POLICY "Only admins can delete credit costs"
  ON credit_costs FOR DELETE
  USING (
    auth.uid() IN (SELECT user_id FROM admin_users WHERE is_active = true)
  );

-- 4. CHAT_SESSIONS TABLE - User-specific isolation
DROP POLICY IF EXISTS "Users can view their own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can create chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can update their sessions" ON chat_sessions;

CREATE POLICY "Users can view their own chat sessions"
  ON chat_sessions FOR SELECT
  USING (
    user_id = auth.uid()
    OR guest_id = auth.uid()::text
    OR assigned_admin_id IN (SELECT user_id FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create chat sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update their sessions"
  ON chat_sessions FOR UPDATE
  USING (
    user_id = auth.uid()
    OR assigned_admin_id IN (SELECT user_id FROM admin_users WHERE user_id = auth.uid())
  );

-- 5. CHAT_MESSAGES TABLE - Session-specific access
DROP POLICY IF EXISTS "Users can view messages in their sessions" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages in their sessions" ON chat_messages;

CREATE POLICY "Users can view messages in their sessions"
  ON chat_messages FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM chat_sessions 
      WHERE user_id = auth.uid() 
      OR guest_id = auth.uid()::text
      OR assigned_admin_id IN (SELECT user_id FROM admin_users WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their sessions"
  ON chat_messages FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM chat_sessions 
      WHERE user_id = auth.uid() 
      OR guest_id = auth.uid()::text
      OR assigned_admin_id IN (SELECT user_id FROM admin_users WHERE user_id = auth.uid())
    )
  );

-- 6. CREDIT_PACKAGES TABLE - Public read for pricing, admin write
DROP POLICY IF EXISTS "Anyone can view active credit packages" ON credit_packages;
DROP POLICY IF EXISTS "Only admins can modify credit packages" ON credit_packages;
DROP POLICY IF EXISTS "Only admins can update credit packages" ON credit_packages;
DROP POLICY IF EXISTS "Only admins can delete credit packages" ON credit_packages;

CREATE POLICY "Anyone can view active credit packages"
  ON credit_packages FOR SELECT
  USING (is_active = true OR auth.uid() IN (SELECT user_id FROM admin_users WHERE is_active = true));

CREATE POLICY "Only admins can insert credit packages"
  ON credit_packages FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM admin_users WHERE is_active = true)
  );

CREATE POLICY "Only admins can update credit packages"
  ON credit_packages FOR UPDATE
  USING (
    auth.uid() IN (SELECT user_id FROM admin_users WHERE is_active = true)
  );

CREATE POLICY "Only admins can delete credit packages"
  ON credit_packages FOR DELETE
  USING (
    auth.uid() IN (SELECT user_id FROM admin_users WHERE is_active = true)
  );
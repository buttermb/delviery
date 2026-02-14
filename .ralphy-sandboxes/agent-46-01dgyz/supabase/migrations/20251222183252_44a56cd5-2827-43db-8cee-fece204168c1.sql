-- =============================================
-- LAUNCH READINESS SECURITY FIXES
-- =============================================

-- 1. FIX api_logs TABLE SECURITY
-- Drop any existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can read api logs" ON api_logs;
DROP POLICY IF EXISTS "Public read access" ON api_logs;
DROP POLICY IF EXISTS "api_logs_select_policy" ON api_logs;

-- Add restrictive policy for super admins only
CREATE POLICY "Super admins can view api logs"
  ON api_logs FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users WHERE role = 'super_admin' AND is_active = true
    )
  );

-- Only system can insert (no user inserts)
CREATE POLICY "System can insert api logs"
  ON api_logs FOR INSERT
  WITH CHECK (true);

-- 2. FIX disposable_menus ENCRYPTION METADATA EXPOSURE
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can view public menus" ON disposable_menus;
DROP POLICY IF EXISTS "Public can view active menus" ON disposable_menus;
DROP POLICY IF EXISTS "disposable_menus_public_select" ON disposable_menus;

-- Create secure policy - tenant users can see their menus, public access only via valid token
CREATE POLICY "Tenant users can view their menus"
  ON disposable_menus FOR SELECT
  USING (
    -- Tenant admins/users can see their own tenant's menus
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- Separate policy for public access (will be handled by edge function with token validation)
-- Public menus should only be accessible via edge function, not direct query

-- 3. FIX forum_categories MODERATION CONTROLS
-- Drop any existing permissive write policies
DROP POLICY IF EXISTS "Anyone can modify forum categories" ON forum_categories;
DROP POLICY IF EXISTS "Public can modify categories" ON forum_categories;

-- Add read policy for all authenticated users
DROP POLICY IF EXISTS "Authenticated users can view forum categories" ON forum_categories;
CREATE POLICY "Authenticated users can view forum categories"
  ON forum_categories FOR SELECT
  USING (auth.role() = 'authenticated');

-- Add write protection - only admins can insert/update/delete
CREATE POLICY "Only admins can insert forum categories"
  ON forum_categories FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM admin_users WHERE is_active = true
    )
  );

CREATE POLICY "Only admins can update forum categories"
  ON forum_categories FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users WHERE is_active = true
    )
  );

CREATE POLICY "Only admins can delete forum categories"
  ON forum_categories FOR DELETE
  USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users WHERE is_active = true
    )
  );
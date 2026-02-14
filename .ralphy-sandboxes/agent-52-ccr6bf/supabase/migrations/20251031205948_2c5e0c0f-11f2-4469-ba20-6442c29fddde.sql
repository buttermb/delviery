-- Add RLS policies for critical tables (final fixed version)

-- ============================================
-- ORDERS TABLE POLICIES
-- ============================================

CREATE POLICY "admin_all_orders" ON orders FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "users_read_own_orders" ON orders FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "couriers_read_assigned_orders" ON orders FOR SELECT TO authenticated
USING (
  courier_id IN (
    SELECT id FROM couriers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "system_insert_orders" ON orders FOR INSERT TO authenticated
WITH CHECK (true);

-- ============================================
-- ORDER_ITEMS TABLE POLICIES
-- ============================================

CREATE POLICY "admin_all_order_items" ON order_items FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "users_read_own_order_items" ON order_items FOR SELECT TO authenticated
USING (
  order_id IN (
    SELECT id FROM orders WHERE user_id = auth.uid()
  )
);

CREATE POLICY "system_insert_order_items" ON order_items FOR INSERT TO authenticated
WITH CHECK (true);

-- ============================================
-- PRODUCTS TABLE POLICIES
-- ============================================

CREATE POLICY "public_read_products" ON products FOR SELECT
USING (true);

CREATE POLICY "admin_all_products" ON products FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- ============================================
-- MENU_ORDERS TABLE POLICIES
-- ============================================

CREATE POLICY "admin_read_menu_orders" ON menu_orders FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "system_create_menu_orders" ON menu_orders FOR INSERT
WITH CHECK (true);

-- ============================================
-- MENU_ACCESS_WHITELIST TABLE POLICIES
-- ============================================

CREATE POLICY "admin_all_whitelist" ON menu_access_whitelist FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "public_read_whitelist" ON menu_access_whitelist FOR SELECT
USING (true);

-- ============================================
-- WHOLESALE_ORDERS TABLE POLICIES
-- ============================================

CREATE POLICY "admin_all_wholesale_orders" ON wholesale_orders FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- ============================================
-- PROFILES TABLE POLICIES  
-- ============================================

CREATE POLICY "users_read_own_profile" ON profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "users_update_own_profile" ON profiles FOR UPDATE TO authenticated
USING (id = auth.uid());

CREATE POLICY "admin_read_all_profiles" ON profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "system_insert_profiles" ON profiles FOR INSERT
WITH CHECK (id = auth.uid());
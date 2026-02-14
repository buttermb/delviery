-- ============================================================================
-- REMOVE PUBLIC READ ACCESS FROM SENSITIVE TABLES
-- ============================================================================
-- CRITICAL SECURITY FIX: Access codes, pricing, and security logs exposed
-- ============================================================================

-- ============================================================================
-- DISPOSABLE_MENUS TABLE - Remove public access to access codes
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all menus" ON public.disposable_menus;
DROP POLICY IF EXISTS "Admins can view all disposable menus" ON public.disposable_menus;
DROP POLICY IF EXISTS "Menu creators can view own menus" ON public.disposable_menus;
DROP POLICY IF EXISTS "Admins can view all menus" ON public.disposable_menus;

-- Only menu creators can view their own menus
CREATE POLICY "Menu creators can view own menus"
    ON public.disposable_menus
    FOR SELECT
    TO authenticated
    USING (
        created_by = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.is_active = true
        )
        OR
        EXISTS (
            SELECT 1 FROM public.super_admin_users
            WHERE super_admin_users.id = auth.uid()::uuid
            AND super_admin_users.status = 'active'
        )
    );

-- Menu creators can insert their own menus
CREATE POLICY "Menu creators can insert menus"
    ON public.disposable_menus
    FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

-- Menu creators can update their own menus
CREATE POLICY "Menu creators can update own menus"
    ON public.disposable_menus
    FOR UPDATE
    TO authenticated
    USING (
        created_by = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.is_active = true
        )
    );

-- Menu creators can delete their own menus
CREATE POLICY "Menu creators can delete own menus"
    ON public.disposable_menus
    FOR DELETE
    TO authenticated
    USING (
        created_by = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.is_active = true
        )
    );

-- ============================================================================
-- PRODUCTS TABLE - Remove public access to pricing
-- ============================================================================
DROP POLICY IF EXISTS "public_read_products" ON public.products;
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
DROP POLICY IF EXISTS "Products viewable by age-verified users only" ON public.products;

-- Only authenticated users can view products (remove public access)
CREATE POLICY "Authenticated users can view products"
    ON public.products
    FOR SELECT
    TO authenticated
    USING (true);

-- Block anonymous access completely
CREATE POLICY "Block anonymous access to products"
    ON public.products
    FOR SELECT
    TO anon
    USING (false);

-- Admins can manage products
CREATE POLICY "Admins can manage products"
    ON public.products
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.is_active = true
        )
        OR
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

-- ============================================================================
-- MENU_SECURITY_EVENTS TABLE - Admin-only access
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view security events" ON public.menu_security_events;
DROP POLICY IF EXISTS "Anyone can create security events" ON public.menu_security_events;

-- Only admins can view security events (not all authenticated users)
CREATE POLICY "Admins can view security events"
    ON public.menu_security_events
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.is_active = true
        )
        OR
        EXISTS (
            SELECT 1 FROM public.super_admin_users
            WHERE super_admin_users.id = auth.uid()::uuid
            AND super_admin_users.status = 'active'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

-- System/edge functions can insert security events (for logging)
CREATE POLICY "System can insert security events"
    ON public.menu_security_events
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (true);

-- Only admins can acknowledge events
CREATE POLICY "Admins can acknowledge security events"
    ON public.menu_security_events
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.is_active = true
        )
        OR
        EXISTS (
            SELECT 1 FROM public.super_admin_users
            WHERE super_admin_users.id = auth.uid()::uuid
            AND super_admin_users.status = 'active'
        )
    );

-- ============================================================================
-- RELATED TABLES - Secure menu products and whitelist
-- ============================================================================

-- Menu products: Only accessible if menu is accessible
DROP POLICY IF EXISTS "Authenticated users can view menu products" ON public.disposable_menu_products;
DROP POLICY IF EXISTS "Authenticated users can manage menu products" ON public.disposable_menu_products;

CREATE POLICY "Users can view menu products for accessible menus"
    ON public.disposable_menu_products
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.disposable_menus
            WHERE disposable_menus.id = disposable_menu_products.menu_id
            AND (
                disposable_menus.created_by = auth.uid()
                OR
                EXISTS (
                    SELECT 1 FROM public.admin_users
                    WHERE admin_users.user_id = auth.uid()
                    AND admin_users.is_active = true
                )
            )
        )
    );

CREATE POLICY "Menu creators can manage their menu products"
    ON public.disposable_menu_products
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.disposable_menus
            WHERE disposable_menus.id = disposable_menu_products.menu_id
            AND disposable_menus.created_by = auth.uid()
        )
    );

-- Menu access whitelist: Only accessible if menu is accessible
DROP POLICY IF EXISTS "Authenticated users can view whitelist" ON public.menu_access_whitelist;
DROP POLICY IF EXISTS "Authenticated users can manage whitelist" ON public.menu_access_whitelist;
DROP POLICY IF EXISTS "Admins can view all whitelist entries" ON public.menu_access_whitelist;

CREATE POLICY "Users can view whitelist for accessible menus"
    ON public.menu_access_whitelist
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.disposable_menus
            WHERE disposable_menus.id = menu_access_whitelist.menu_id
            AND (
                disposable_menus.created_by = auth.uid()
                OR
                EXISTS (
                    SELECT 1 FROM public.admin_users
                    WHERE admin_users.user_id = auth.uid()
                    AND admin_users.is_active = true
                )
            )
        )
    );

CREATE POLICY "Menu creators can manage their whitelist"
    ON public.menu_access_whitelist
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.disposable_menus
            WHERE disposable_menus.id = menu_access_whitelist.menu_id
            AND disposable_menus.created_by = auth.uid()
        )
    );


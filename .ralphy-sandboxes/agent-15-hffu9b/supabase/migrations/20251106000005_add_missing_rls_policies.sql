-- ============================================================================
-- ADD RLS POLICIES FOR TABLES WITHOUT POLICIES (SIMPLIFIED VERSION)
-- ============================================================================
-- Fixes tables that have RLS enabled but no policies
-- Based on actual table existence in database
-- ============================================================================

-- ============================================================================
-- FEATURE_FLAGS TABLE
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_flags') THEN
        ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Public can view feature flags" ON public.feature_flags;
        DROP POLICY IF EXISTS "Super admins can manage feature flags" ON public.feature_flags;
        DROP POLICY IF EXISTS "Admins can manage feature flags" ON public.feature_flags;
        
        -- Public read for feature flags (needed for plan comparisons)
        CREATE POLICY "Public can view feature flags"
            ON public.feature_flags
            FOR SELECT
            USING (true);
        
        -- Only admins can manage
        CREATE POLICY "Admins can manage feature flags"
            ON public.feature_flags
            FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.admin_users
                    WHERE admin_users.user_id = auth.uid()
                    AND admin_users.is_active = true
                )
            );
    END IF;
END $$;

-- ============================================================================
-- MENU_ACCESS TABLE
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_access') THEN
        ALTER TABLE public.menu_access ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Customers can view own access" ON public.menu_access;
        DROP POLICY IF EXISTS "Menu creators can manage access" ON public.menu_access;
        
        -- Customers can view their own access
        CREATE POLICY "Customers can view own access"
            ON public.menu_access
            FOR SELECT
            TO authenticated
            USING (
                customer_id = auth.uid()::text
                OR
                EXISTS (
                    SELECT 1 FROM public.customer_users
                    WHERE customer_users.id::text = menu_access.customer_id
                    AND customer_users.user_id = auth.uid()
                )
            );
        
        -- Menu creators/admins can manage access
        CREATE POLICY "Menu creators can manage access"
            ON public.menu_access
            FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.menus
                    WHERE menus.id = menu_access.menu_id::uuid
                    AND (
                        menus.created_by = auth.uid()
                        OR
                        EXISTS (
                            SELECT 1 FROM public.admin_users
                            WHERE admin_users.user_id = auth.uid()
                            AND admin_users.is_active = true
                        )
                    )
                )
            );
    END IF;
END $$;

-- ============================================================================
-- MENUS TABLE
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menus') THEN
        ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Menu creators can view own menus" ON public.menus;
        DROP POLICY IF EXISTS "Admins can view all menus" ON public.menus;
        DROP POLICY IF EXISTS "Menu creators can manage menus" ON public.menus;
        
        -- Menu creators can view their own menus
        CREATE POLICY "Menu creators can view own menus"
            ON public.menus
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
            );
        
        -- Menu creators can manage their own menus
        CREATE POLICY "Menu creators can manage menus"
            ON public.menus
            FOR ALL
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
    END IF;
END $$;

-- ============================================================================
-- MENU_PRODUCTS TABLE
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_products') THEN
        ALTER TABLE public.menu_products ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Users can view menu products" ON public.menu_products;
        DROP POLICY IF EXISTS "Menu creators can manage menu products" ON public.menu_products;
        
        -- Users can view menu products for accessible menus
        CREATE POLICY "Users can view menu products"
            ON public.menu_products
            FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.menus
                    WHERE menus.id = menu_products.menu_id::uuid
                    AND (
                        menus.created_by = auth.uid()
                        OR
                        EXISTS (
                            SELECT 1 FROM public.admin_users
                            WHERE admin_users.user_id = auth.uid()
                            AND admin_users.is_active = true
                        )
                    )
                )
            );
        
        -- Menu creators can manage
        CREATE POLICY "Menu creators can manage menu products"
            ON public.menu_products
            FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.menus
                    WHERE menus.id = menu_products.menu_id::uuid
                    AND menus.created_by = auth.uid()
                )
            );
    END IF;
END $$;

-- ============================================================================
-- USAGE_EVENTS TABLE
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usage_events') THEN
        ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Tenants can view own usage" ON public.usage_events;
        DROP POLICY IF EXISTS "Super admins can view all usage" ON public.usage_events;
        DROP POLICY IF EXISTS "Admins can view all usage" ON public.usage_events;
        DROP POLICY IF EXISTS "System can insert usage events" ON public.usage_events;
        
        -- Tenants can view their own usage
        CREATE POLICY "Tenants can view own usage"
            ON public.usage_events
            FOR SELECT
            TO authenticated
            USING (
                tenant_id IN (
                    SELECT tenant_id FROM public.tenant_users
                    WHERE tenant_users.user_id = auth.uid()
                    AND tenant_users.status = 'active'
                )
            );
        
        -- Admins can view all
        CREATE POLICY "Admins can view all usage"
            ON public.usage_events
            FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.admin_users
                    WHERE admin_users.user_id = auth.uid()
                    AND admin_users.is_active = true
                )
            );
        
        -- System can insert
        CREATE POLICY "System can insert usage events"
            ON public.usage_events
            FOR INSERT
            TO authenticated, anon
            WITH CHECK (true);
    END IF;
END $$;

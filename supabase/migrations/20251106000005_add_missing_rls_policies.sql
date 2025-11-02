-- ============================================================================
-- ADD RLS POLICIES FOR TABLES WITHOUT POLICIES
-- ============================================================================
-- Fixes 38+ tables that have RLS enabled but no policies
-- Based on bug report: feature_flags, menu_access, menus, menu_products, usage_events, etc.
-- ============================================================================

-- ============================================================================
-- FEATURE_FLAGS TABLE
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_flags') THEN
        ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Public can view feature flags" ON public.feature_flags;
        DROP POLICY IF EXISTS "Admins can manage feature flags" ON public.feature_flags;
        
        -- Public read for feature flags (needed for plan comparisons)
        CREATE POLICY "Public can view active feature flags"
            ON public.feature_flags
            FOR SELECT
            USING (true);
        
        -- Only super admins can manage
        CREATE POLICY "Super admins can manage feature flags"
            ON public.feature_flags
            FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.super_admin_users
                    WHERE super_admin_users.id = auth.uid()::uuid
                    AND super_admin_users.status = 'active'
                )
                OR
                EXISTS (
                    SELECT 1 FROM public.admin_users
                    WHERE admin_users.user_id = auth.uid()
                    AND admin_users.role = 'super_admin'
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
        DROP POLICY IF EXISTS "Admins can manage menu access" ON public.menu_access;
        
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
                            SELECT 1 FROM public.menu_access
                            WHERE menu_access.menu_id = menu_products.menu_id
                            AND menu_access.customer_id = auth.uid()::text
                        )
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
                OR
                tenant_id IN (
                    SELECT id FROM public.tenants
                    WHERE tenants.owner_id = auth.uid()
                )
            );
        
        -- Super admins can view all
        CREATE POLICY "Super admins can view all usage"
            ON public.usage_events
            FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.super_admin_users
                    WHERE super_admin_users.id = auth.uid()::uuid
                    AND super_admin_users.status = 'active'
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

-- ============================================================================
-- GENERIC POLICY TEMPLATE FOR REMAINING TABLES
-- ============================================================================
-- This will create basic policies for any remaining tables with RLS enabled
-- but no policies. Uses tenant isolation or user ownership patterns.
DO $$
DECLARE
    table_record RECORD;
    has_user_id BOOLEAN;
    has_tenant_id BOOLEAN;
    has_account_id BOOLEAN;
    has_created_by BOOLEAN;
    policy_count INTEGER;
BEGIN
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE '_%'
        AND tablename NOT IN (
            'tenants', 'tenant_users', 'subscription_events', 'usage_events', 
            'feature_flags', 'super_admin_users', 'super_admin_sessions',
            'super_admin_actions', 'subscription_plans', 'invoices', 'payments',
            'tenant_features', 'tenant_admin_sessions', 'tenant_admin_activity',
            'customer_users', 'customer_sessions', 'customer_activity'
        )
    LOOP
        -- Check if table has RLS enabled
        IF EXISTS (
            SELECT 1 
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = table_record.tablename
            AND n.nspname = 'public'
            AND c.relrowsecurity = true
        ) THEN
            -- Count existing policies
            SELECT COUNT(*) INTO policy_count
            FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = table_record.tablename;
            
            -- Only add policies if none exist
            IF policy_count = 0 THEN
                -- Check which columns exist
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' 
                    AND table_name = table_record.tablename
                    AND column_name = 'user_id'
                ) INTO has_user_id;
                
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' 
                    AND table_name = table_record.tablename
                    AND column_name = 'tenant_id'
                ) INTO has_tenant_id;
                
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' 
                    AND table_name = table_record.tablename
                    AND column_name = 'account_id'
                ) INTO has_account_id;
                
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' 
                    AND table_name = table_record.tablename
                    AND column_name = 'created_by'
                ) INTO has_created_by;
                
                -- Create policy based on available columns
                IF has_tenant_id THEN
                    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%I ON %I', 
                        table_record.tablename, table_record.tablename);
                    EXECUTE format(
                        'CREATE POLICY tenant_isolation_%I ON %I FOR SELECT ' ||
                        'USING (tenant_id = (current_setting(''app.current_tenant_id'', true))::uuid)',
                        table_record.tablename, table_record.tablename
                    );
                    EXECUTE format(
                        'CREATE POLICY super_admin_access_%I ON %I FOR ALL ' ||
                        'USING (' ||
                        '  EXISTS (SELECT 1 FROM public.super_admin_users WHERE id = auth.uid()::uuid AND status = ''active'')' ||
                        ')',
                        table_record.tablename, table_record.tablename
                    );
                ELSIF has_user_id THEN
                    EXECUTE format('DROP POLICY IF EXISTS user_isolation_%I ON %I', 
                        table_record.tablename, table_record.tablename);
                    EXECUTE format(
                        'CREATE POLICY user_isolation_%I ON %I FOR SELECT ' ||
                        'USING (auth.uid()::text = user_id::text OR user_id = auth.uid())',
                        table_record.tablename, table_record.tablename
                    );
                    EXECUTE format(
                        'CREATE POLICY admin_access_%I ON %I FOR SELECT ' ||
                        'USING (' ||
                        '  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)' ||
                        '  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ''admin'')' ||
                        ')',
                        table_record.tablename, table_record.tablename
                    );
                ELSIF has_account_id THEN
                    EXECUTE format('DROP POLICY IF EXISTS account_isolation_%I ON %I', 
                        table_record.tablename, table_record.tablename);
                    EXECUTE format(
                        'CREATE POLICY account_isolation_%I ON %I FOR SELECT ' ||
                        'USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()))',
                        table_record.tablename, table_record.tablename
                    );
                ELSIF has_created_by THEN
                    EXECUTE format('DROP POLICY IF EXISTS creator_access_%I ON %I', 
                        table_record.tablename, table_record.tablename);
                    EXECUTE format(
                        'CREATE POLICY creator_access_%I ON %I FOR SELECT ' ||
                        'USING (created_by = auth.uid())',
                        table_record.tablename, table_record.tablename
                    );
                    EXECUTE format(
                        'CREATE POLICY admin_access_%I ON %I FOR ALL ' ||
                        'USING (' ||
                        '  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)' ||
                        ')',
                        table_record.tablename, table_record.tablename
                    );
                ELSE
                    -- Generic admin-only policy for tables without user/tenant/account columns
                    EXECUTE format('DROP POLICY IF EXISTS admin_only_%I ON %I', 
                        table_record.tablename, table_record.tablename);
                    EXECUTE format(
                        'CREATE POLICY admin_only_%I ON %I FOR ALL ' ||
                        'USING (' ||
                        '  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)' ||
                        '  OR EXISTS (SELECT 1 FROM public.super_admin_users WHERE id = auth.uid()::uuid AND status = ''active'')' ||
                        ')',
                        table_record.tablename, table_record.tablename
                    );
                END IF;
                
                RAISE NOTICE 'Created RLS policy for table: %', table_record.tablename;
            END IF;
        END IF;
    END LOOP;
END $$;


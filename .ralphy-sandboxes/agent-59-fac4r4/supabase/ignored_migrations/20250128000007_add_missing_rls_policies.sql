-- ============================================================================
-- ADD MISSING RLS POLICIES TO ALL TABLES
-- ============================================================================
-- Phase 1.3: Add tenant-scoped RLS policies to all tables that have RLS enabled
-- but no policies (complete data exposure risk)
-- Uses tenant_users table for proper tenant isolation
-- ============================================================================

-- ============================================================================
-- Find all tables with RLS enabled but no policies and add tenant-scoped policies
-- ============================================================================
DO $$
DECLARE
    table_record RECORD;
    has_tenant_id BOOLEAN;
    has_user_id BOOLEAN;
    has_account_id BOOLEAN;
    policy_count INTEGER;
BEGIN
    -- Loop through all tables in public schema
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE '_%'
        AND tablename NOT IN ('tenants', 'tenant_users', '_prisma_migrations')
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
            
            -- Only proceed if no policies exist
            IF policy_count = 0 THEN
                -- Check which columns exist
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
                    AND column_name = 'user_id'
                ) INTO has_user_id;
                
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' 
                    AND table_name = table_record.tablename
                    AND column_name = 'account_id'
                ) INTO has_account_id;
                
                -- Create policy based on available columns
                IF has_tenant_id THEN
                    -- Tenant-scoped policy using tenant_users
                    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%I ON %I', 
                        table_record.tablename, table_record.tablename);
                    EXECUTE format(
                        'CREATE POLICY tenant_isolation_%I ON %I FOR ALL ' ||
                        'USING (
                            tenant_id IN (
                                SELECT tenant_id FROM public.tenant_users
                                WHERE tenant_users.user_id = auth.uid()
                                AND tenant_users.status = ''active''
                            )
                        ) ' ||
                        'WITH CHECK (
                            tenant_id IN (
                                SELECT tenant_id FROM public.tenant_users
                                WHERE tenant_users.user_id = auth.uid()
                                AND tenant_users.status = ''active''
                            )
                        )',
                        table_record.tablename, table_record.tablename
                    );
                    RAISE NOTICE 'Created tenant-scoped RLS policy for table: %', table_record.tablename;
                ELSIF has_user_id THEN
                    -- User-scoped policy
                    EXECUTE format('DROP POLICY IF EXISTS user_isolation_%I ON %I', 
                        table_record.tablename, table_record.tablename);
                    EXECUTE format(
                        'CREATE POLICY user_isolation_%I ON %I FOR SELECT ' ||
                        'USING (auth.uid()::text = user_id::text)',
                        table_record.tablename, table_record.tablename
                    );
                    RAISE NOTICE 'Created user-scoped RLS policy for table: %', table_record.tablename;
                ELSIF has_account_id THEN
                    -- Account-scoped policy
                    EXECUTE format('DROP POLICY IF EXISTS account_isolation_%I ON %I', 
                        table_record.tablename, table_record.tablename);
                    EXECUTE format(
                        'CREATE POLICY account_isolation_%I ON %I FOR SELECT ' ||
                        'USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()))',
                        table_record.tablename, table_record.tablename
                    );
                    RAISE NOTICE 'Created account-scoped RLS policy for table: %', table_record.tablename;
                ELSE
                    -- Generic admin-only policy for tables without isolation columns
                    EXECUTE format('DROP POLICY IF EXISTS admin_only_%I ON %I', 
                        table_record.tablename, table_record.tablename);
                    EXECUTE format(
                        'CREATE POLICY admin_only_%I ON %I FOR ALL ' ||
                        'USING (
                            EXISTS (
                                SELECT 1 FROM public.admin_users
                                WHERE admin_users.user_id = auth.uid()
                                AND admin_users.is_active = true
                            )
                        )',
                        table_record.tablename, table_record.tablename
                    );
                    RAISE NOTICE 'Created admin-only RLS policy for table: %', table_record.tablename;
                END IF;
            END IF;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- Specific tables mentioned in user's report - ensure they have policies
-- ============================================================================

-- menu_access_whitelist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_access_whitelist') THEN
        ALTER TABLE menu_access_whitelist ENABLE ROW LEVEL SECURITY;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'menu_access_whitelist'
        ) THEN
            -- Add tenant-scoped policy if tenant_id exists
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' 
                AND table_name = 'menu_access_whitelist'
                AND column_name = 'tenant_id'
            ) THEN
                CREATE POLICY "tenant_isolation_menu_access_whitelist"
                    ON menu_access_whitelist FOR ALL
                    USING (
                        tenant_id IN (
                            SELECT tenant_id FROM public.tenant_users
                            WHERE tenant_users.user_id = auth.uid()
                            AND tenant_users.status = 'active'
                        )
                    );
            END IF;
        END IF;
    END IF;
END $$;

-- menu_access_logs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_access_logs') THEN
        ALTER TABLE menu_access_logs ENABLE ROW LEVEL SECURITY;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'menu_access_logs'
        ) THEN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' 
                AND table_name = 'menu_access_logs'
                AND column_name = 'tenant_id'
            ) THEN
                CREATE POLICY "tenant_isolation_menu_access_logs"
                    ON menu_access_logs FOR ALL
                    USING (
                        tenant_id IN (
                            SELECT tenant_id FROM public.tenant_users
                            WHERE tenant_users.user_id = auth.uid()
                            AND tenant_users.status = 'active'
                        )
                    );
            END IF;
        END IF;
    END IF;
END $$;

-- menu_security_events
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_security_events') THEN
        ALTER TABLE menu_security_events ENABLE ROW LEVEL SECURITY;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'menu_security_events'
        ) THEN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' 
                AND table_name = 'menu_security_events'
                AND column_name = 'tenant_id'
            ) THEN
                CREATE POLICY "tenant_isolation_menu_security_events"
                    ON menu_security_events FOR ALL
                    USING (
                        tenant_id IN (
                            SELECT tenant_id FROM public.tenant_users
                            WHERE tenant_users.user_id = auth.uid()
                            AND tenant_users.status = 'active'
                        )
                    );
            END IF;
        END IF;
    END IF;
END $$;

-- menu_view_tracking
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_view_tracking') THEN
        ALTER TABLE menu_view_tracking ENABLE ROW LEVEL SECURITY;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'menu_view_tracking'
        ) THEN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' 
                AND table_name = 'menu_view_tracking'
                AND column_name = 'tenant_id'
            ) THEN
                CREATE POLICY "tenant_isolation_menu_view_tracking"
                    ON menu_view_tracking FOR ALL
                    USING (
                        tenant_id IN (
                            SELECT tenant_id FROM public.tenant_users
                            WHERE tenant_users.user_id = auth.uid()
                            AND tenant_users.status = 'active'
                        )
                    );
            END IF;
        END IF;
    END IF;
END $$;

-- inventory_transfers
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_transfers') THEN
        ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'inventory_transfers'
        ) THEN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' 
                AND table_name = 'inventory_transfers'
                AND column_name = 'tenant_id'
            ) THEN
                CREATE POLICY "tenant_isolation_inventory_transfers"
                    ON inventory_transfers FOR ALL
                    USING (
                        tenant_id IN (
                            SELECT tenant_id FROM public.tenant_users
                            WHERE tenant_users.user_id = auth.uid()
                            AND tenant_users.status = 'active'
                        )
                    );
            END IF;
        END IF;
    END IF;
END $$;

-- fronted_inventory
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fronted_inventory') THEN
        ALTER TABLE fronted_inventory ENABLE ROW LEVEL SECURITY;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'fronted_inventory'
        ) THEN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' 
                AND table_name = 'fronted_inventory'
                AND column_name = 'tenant_id'
            ) THEN
                CREATE POLICY "tenant_isolation_fronted_inventory"
                    ON fronted_inventory FOR ALL
                    USING (
                        tenant_id IN (
                            SELECT tenant_id FROM public.tenant_users
                            WHERE tenant_users.user_id = auth.uid()
                            AND tenant_users.status = 'active'
                        )
                    );
            END IF;
        END IF;
    END IF;
END $$;

-- custom_reports
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'custom_reports') THEN
        ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'custom_reports'
        ) THEN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' 
                AND table_name = 'custom_reports'
                AND column_name = 'tenant_id'
            ) THEN
                CREATE POLICY "tenant_isolation_custom_reports"
                    ON custom_reports FOR ALL
                    USING (
                        tenant_id IN (
                            SELECT tenant_id FROM public.tenant_users
                            WHERE tenant_users.user_id = auth.uid()
                            AND tenant_users.status = 'active'
                        )
                    );
            END IF;
        END IF;
    END IF;
END $$;

-- report_executions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'report_executions') THEN
        ALTER TABLE report_executions ENABLE ROW LEVEL SECURITY;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'report_executions'
        ) THEN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' 
                AND table_name = 'report_executions'
                AND column_name = 'tenant_id'
            ) THEN
                CREATE POLICY "tenant_isolation_report_executions"
                    ON report_executions FOR ALL
                    USING (
                        tenant_id IN (
                            SELECT tenant_id FROM public.tenant_users
                            WHERE tenant_users.user_id = auth.uid()
                            AND tenant_users.status = 'active'
                        )
                    );
            END IF;
        END IF;
    END IF;
END $$;

-- Comments
COMMENT ON POLICY "tenant_isolation_% ON public.*" IS 'Tenant-scoped RLS policy for multi-tenant data isolation';


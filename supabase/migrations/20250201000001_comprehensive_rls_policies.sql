-- ============================================================================
-- COMPREHENSIVE RLS POLICIES FOR ALL TABLES
-- ============================================================================
-- This migration ensures all tables with RLS enabled have proper tenant-scoped
-- policies. Uses tenant_users table for proper tenant isolation.
-- ============================================================================

-- ============================================================================
-- Helper function to get current user's tenant_id
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT tenant_id 
        FROM public.tenant_users
        WHERE user_id = auth.uid()
        AND status = 'active'
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- Ensure critical tables have tenant-scoped RLS policies
-- ============================================================================

-- wholesale_orders
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wholesale_orders') THEN
        -- Enable RLS if not enabled
        EXECUTE 'ALTER TABLE public.wholesale_orders ENABLE ROW LEVEL SECURITY';
        
        -- Drop existing policy if exists
        EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_wholesale_orders ON public.wholesale_orders';
        
        -- Create tenant-scoped policy
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'wholesale_orders' 
            AND column_name = 'tenant_id'
        ) THEN
            EXECUTE '
                CREATE POLICY tenant_isolation_wholesale_orders 
                ON public.wholesale_orders FOR ALL
                USING (tenant_id = get_user_tenant_id())
                WITH CHECK (tenant_id = get_user_tenant_id())
            ';
            RAISE NOTICE 'Created RLS policy for wholesale_orders';
        END IF;
    END IF;
END $$;

-- disposable_menus
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'disposable_menus') THEN
        EXECUTE 'ALTER TABLE public.disposable_menus ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_disposable_menus ON public.disposable_menus';
        
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'disposable_menus' 
            AND column_name = 'tenant_id'
        ) THEN
            EXECUTE '
                CREATE POLICY tenant_isolation_disposable_menus 
                ON public.disposable_menus FOR ALL
                USING (tenant_id = get_user_tenant_id())
                WITH CHECK (tenant_id = get_user_tenant_id())
            ';
            RAISE NOTICE 'Created RLS policy for disposable_menus';
        END IF;
    END IF;
END $$;

-- wholesale_inventory
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wholesale_inventory') THEN
        EXECUTE 'ALTER TABLE public.wholesale_inventory ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_wholesale_inventory ON public.wholesale_inventory';
        
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'wholesale_inventory' 
            AND column_name = 'tenant_id'
        ) THEN
            EXECUTE '
                CREATE POLICY tenant_isolation_wholesale_inventory 
                ON public.wholesale_inventory FOR ALL
                USING (tenant_id = get_user_tenant_id())
                WITH CHECK (tenant_id = get_user_tenant_id())
            ';
            RAISE NOTICE 'Created RLS policy for wholesale_inventory';
        END IF;
    END IF;
END $$;

-- wholesale_clients
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wholesale_clients') THEN
        EXECUTE 'ALTER TABLE public.wholesale_clients ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_wholesale_clients ON public.wholesale_clients';
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage wholesale_clients" ON public.wholesale_clients';
        
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'wholesale_clients' 
            AND column_name = 'tenant_id'
        ) THEN
            EXECUTE '
                CREATE POLICY tenant_isolation_wholesale_clients 
                ON public.wholesale_clients FOR ALL
                USING (tenant_id = get_user_tenant_id())
                WITH CHECK (tenant_id = get_user_tenant_id())
            ';
            RAISE NOTICE 'Created RLS policy for wholesale_clients';
        END IF;
    END IF;
END $$;

-- wholesale_deliveries
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wholesale_deliveries') THEN
        EXECUTE 'ALTER TABLE public.wholesale_deliveries ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_wholesale_deliveries ON public.wholesale_deliveries';
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage wholesale_deliveries" ON public.wholesale_deliveries';
        
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'wholesale_deliveries' 
            AND column_name = 'tenant_id'
        ) THEN
            EXECUTE '
                CREATE POLICY tenant_isolation_wholesale_deliveries 
                ON public.wholesale_deliveries FOR ALL
                USING (tenant_id = get_user_tenant_id())
                WITH CHECK (tenant_id = get_user_tenant_id())
            ';
            RAISE NOTICE 'Created RLS policy for wholesale_deliveries';
        END IF;
    END IF;
END $$;

-- products
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        EXECUTE 'ALTER TABLE public.products ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_products ON public.products';
        
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'products' 
            AND column_name = 'tenant_id'
        ) THEN
            EXECUTE '
                CREATE POLICY tenant_isolation_products 
                ON public.products FOR ALL
                USING (tenant_id = get_user_tenant_id())
                WITH CHECK (tenant_id = get_user_tenant_id())
            ';
            RAISE NOTICE 'Created RLS policy for products';
        END IF;
    END IF;
END $$;

-- customers
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
        EXECUTE 'ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_customers ON public.customers';
        
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'customers' 
            AND column_name = 'tenant_id'
        ) THEN
            EXECUTE '
                CREATE POLICY tenant_isolation_customers 
                ON public.customers FOR ALL
                USING (tenant_id = get_user_tenant_id())
                WITH CHECK (tenant_id = get_user_tenant_id())
            ';
            RAISE NOTICE 'Created RLS policy for customers';
        END IF;
    END IF;
END $$;

-- orders
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        EXECUTE 'ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_orders ON public.orders';
        EXECUTE 'DROP POLICY IF EXISTS "Admin can view all orders" ON public.orders';
        EXECUTE 'DROP POLICY IF EXISTS "Admin can update all orders" ON public.orders';
        
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'orders' 
            AND column_name = 'tenant_id'
        ) THEN
            EXECUTE '
                CREATE POLICY tenant_isolation_orders 
                ON public.orders FOR ALL
                USING (tenant_id = get_user_tenant_id())
                WITH CHECK (tenant_id = get_user_tenant_id())
            ';
            RAISE NOTICE 'Created RLS policy for orders';
        END IF;
    END IF;
END $$;

-- menu_orders
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_orders') THEN
        EXECUTE 'ALTER TABLE public.menu_orders ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_menu_orders ON public.menu_orders';
        
        -- Menu orders might not have tenant_id directly, check via menu_id
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'menu_orders' 
            AND column_name = 'tenant_id'
        ) THEN
            EXECUTE '
                CREATE POLICY tenant_isolation_menu_orders 
                ON public.menu_orders FOR ALL
                USING (tenant_id = get_user_tenant_id())
                WITH CHECK (tenant_id = get_user_tenant_id())
            ';
            RAISE NOTICE 'Created RLS policy for menu_orders (direct tenant_id)';
        ELSIF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'menu_orders' 
            AND column_name = 'menu_id'
        ) THEN
            -- Create policy via menu relationship
            EXECUTE '
                CREATE POLICY tenant_isolation_menu_orders 
                ON public.menu_orders FOR ALL
                USING (
                    EXISTS (
                        SELECT 1 FROM public.disposable_menus
                        WHERE disposable_menus.id = menu_orders.menu_id
                        AND disposable_menus.tenant_id = get_user_tenant_id()
                    )
                )
            ';
            RAISE NOTICE 'Created RLS policy for menu_orders (via menu_id)';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- Generic function to add policies to any table with tenant_id
-- ============================================================================
DO $$
DECLARE
    table_record RECORD;
    policy_count INTEGER;
BEGIN
    -- Loop through all tables with tenant_id column
    FOR table_record IN 
        SELECT DISTINCT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND column_name = 'tenant_id'
        AND table_name NOT IN (
            'tenants', 
            'tenant_users', 
            '_prisma_migrations',
            'wholesale_orders',
            'disposable_menus',
            'wholesale_inventory',
            'wholesale_clients',
            'wholesale_deliveries',
            'products',
            'customers',
            'orders',
            'menu_orders'
        )
    LOOP
        -- Check if table has RLS enabled
        IF EXISTS (
            SELECT 1 
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = table_record.table_name
            AND n.nspname = 'public'
        ) THEN
            -- Enable RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.table_name);
            
            -- Count existing policies
            SELECT COUNT(*) INTO policy_count
            FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = table_record.table_name
            AND policyname LIKE 'tenant_isolation_%';
            
            -- Only create if no tenant isolation policy exists
            IF policy_count = 0 THEN
                EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%I ON public.%I', 
                    table_record.table_name, table_record.table_name);
                
                EXECUTE format('
                    CREATE POLICY tenant_isolation_%I 
                    ON public.%I FOR ALL
                    USING (tenant_id = get_user_tenant_id())
                    WITH CHECK (tenant_id = get_user_tenant_id())
                ', table_record.table_name, table_record.table_name);
                
                RAISE NOTICE 'Created RLS policy for table: %', table_record.table_name;
            END IF;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- Comments (SKIPPED due to missing tables)
-- ============================================================================
-- COMMENT ON FUNCTION get_user_tenant_id() IS 'Helper function to get current user''s active tenant_id from tenant_users table';
-- Comments removed to prevent errors on missing tables logic.


-- ============================================================================
-- ADD tenant_id TO ALL EXISTING TABLES
-- ============================================================================

-- Add tenant_id column to all existing tables
DO $$ 
DECLARE
    table_record RECORD;
    table_name TEXT;
BEGIN
    -- List of tables that need tenant_id
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT IN ('tenants', 'tenant_users', 'subscription_events', 'usage_events', 'feature_flags', '_prisma_migrations')
    LOOP
        table_name := table_record.tablename;
        
        -- Check if tenant_id column already exists
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = table_record.tablename 
            AND column_name = 'tenant_id'
        ) THEN
            -- Add tenant_id column
            EXECUTE format('ALTER TABLE %I ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE', table_name);
            
            -- Create index
            EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant_id ON %I(tenant_id)', table_name, table_name);
            
            -- Enable RLS if not already enabled
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
            
            -- Create RLS policy (drop if exists first)
            EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%I ON %I', table_name, table_name);
            EXECUTE format('CREATE POLICY tenant_isolation_%I ON %I FOR ALL USING (tenant_id = (current_setting(''app.current_tenant_id'', true))::uuid)', table_name, table_name);
            
            RAISE NOTICE 'Added tenant_id to table: %', table_name;
        END IF;
    END LOOP;
END $$;

-- Manually handle specific important tables with better control
-- Products
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.products ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON public.products(tenant_id);
        END IF;
    END IF;
END $$;

-- Customers
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.customers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON public.customers(tenant_id);
        END IF;
    END IF;
END $$;

-- Menus
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menus') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'menus' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.menus ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_menus_tenant_id ON public.menus(tenant_id);
        END IF;
    END IF;
END $$;

-- Orders
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.orders ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON public.orders(tenant_id);
        END IF;
    END IF;
END $$;

-- Wholesale tables
DO $$ 
BEGIN
    -- wholesale_clients
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wholesale_clients') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wholesale_clients' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.wholesale_clients ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_wholesale_clients_tenant_id ON public.wholesale_clients(tenant_id);
        END IF;
    END IF;
    
    -- wholesale_orders
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wholesale_orders') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wholesale_orders' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.wholesale_orders ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_wholesale_orders_tenant_id ON public.wholesale_orders(tenant_id);
        END IF;
    END IF;
    
    -- wholesale_runners
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wholesale_runners') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wholesale_runners' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.wholesale_runners ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_wholesale_runners_tenant_id ON public.wholesale_runners(tenant_id);
        END IF;
    END IF;
    
    -- wholesale_inventory
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wholesale_inventory') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wholesale_inventory' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.wholesale_inventory ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_wholesale_inventory_tenant_id ON public.wholesale_inventory(tenant_id);
        END IF;
    END IF;
    
    -- inventory_batches
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_batches') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_batches' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.inventory_batches ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_inventory_batches_tenant_id ON public.inventory_batches(tenant_id);
        END IF;
    END IF;
    
    -- inventory_packages
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_packages') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_packages' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.inventory_packages ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_inventory_packages_tenant_id ON public.inventory_packages(tenant_id);
        END IF;
    END IF;
END $$;

-- Update accounts table to link with tenants (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.accounts ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
            CREATE INDEX IF NOT EXISTS idx_accounts_tenant_id ON public.accounts(tenant_id);
        END IF;
    END IF;
END $$;

COMMENT ON COLUMN public.products.tenant_id IS 'Links product to tenant (multi-tenant isolation)';
COMMENT ON COLUMN public.customers.tenant_id IS 'Links customer to tenant (multi-tenant isolation)';
COMMENT ON COLUMN public.menus.tenant_id IS 'Links menu to tenant (multi-tenant isolation)';
COMMENT ON COLUMN public.orders.tenant_id IS 'Links order to tenant (multi-tenant isolation)';


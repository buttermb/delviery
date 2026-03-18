-- ============================================================================
-- CRITICAL FIX: Add tenant_id to tables causing 400 errors on live site
-- ============================================================================
-- Tables: disposable_menus, wholesale_orders, wholesale_inventory, 
--         wholesale_deliveries, wholesale_clients
-- ============================================================================

DO $$ 
DECLARE
  v_first_tenant_id UUID;
BEGIN
  -- Get first tenant ID for backfilling
  SELECT id INTO v_first_tenant_id FROM public.tenants ORDER BY created_at LIMIT 1;
  
  IF v_first_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenants found in database. Cannot proceed with migration.';
  END IF;

  -- ============================================================================
  -- 1. DISPOSABLE_MENUS
  -- ============================================================================
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'disposable_menus' 
    AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.disposable_menus 
    ADD COLUMN tenant_id UUID;
    
    UPDATE public.disposable_menus 
    SET tenant_id = v_first_tenant_id 
    WHERE tenant_id IS NULL;
    
    ALTER TABLE public.disposable_menus 
    ALTER COLUMN tenant_id SET NOT NULL;
    
    ALTER TABLE public.disposable_menus 
    ADD CONSTRAINT fk_disposable_menus_tenant 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
    
    CREATE INDEX idx_disposable_menus_tenant_id ON public.disposable_menus(tenant_id);
    
    RAISE NOTICE 'Added tenant_id to disposable_menus';
  END IF;

  -- ============================================================================
  -- 2. WHOLESALE_CLIENTS
  -- ============================================================================
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'wholesale_clients' 
    AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.wholesale_clients 
    ADD COLUMN tenant_id UUID;
    
    UPDATE public.wholesale_clients 
    SET tenant_id = v_first_tenant_id 
    WHERE tenant_id IS NULL;
    
    ALTER TABLE public.wholesale_clients 
    ALTER COLUMN tenant_id SET NOT NULL;
    
    ALTER TABLE public.wholesale_clients 
    ADD CONSTRAINT fk_wholesale_clients_tenant 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
    
    CREATE INDEX idx_wholesale_clients_tenant_id ON public.wholesale_clients(tenant_id);
    
    RAISE NOTICE 'Added tenant_id to wholesale_clients';
  END IF;

  -- ============================================================================
  -- 3. WHOLESALE_INVENTORY
  -- ============================================================================
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'wholesale_inventory' 
    AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.wholesale_inventory 
    ADD COLUMN tenant_id UUID;
    
    UPDATE public.wholesale_inventory 
    SET tenant_id = v_first_tenant_id 
    WHERE tenant_id IS NULL;
    
    ALTER TABLE public.wholesale_inventory 
    ALTER COLUMN tenant_id SET NOT NULL;
    
    ALTER TABLE public.wholesale_inventory 
    ADD CONSTRAINT fk_wholesale_inventory_tenant 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
    
    CREATE INDEX idx_wholesale_inventory_tenant_id ON public.wholesale_inventory(tenant_id);
    
    RAISE NOTICE 'Added tenant_id to wholesale_inventory';
  END IF;

  -- ============================================================================
  -- 4. WHOLESALE_ORDERS (inherits from wholesale_clients)
  -- ============================================================================
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'wholesale_orders' 
    AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.wholesale_orders 
    ADD COLUMN tenant_id UUID;
    
    -- Try to inherit from wholesale_clients first
    UPDATE public.wholesale_orders o
    SET tenant_id = (
      SELECT c.tenant_id 
      FROM public.wholesale_clients c 
      WHERE c.id = o.client_id 
      LIMIT 1
    )
    WHERE tenant_id IS NULL AND client_id IS NOT NULL;
    
    -- Fallback to first tenant for remaining
    UPDATE public.wholesale_orders 
    SET tenant_id = v_first_tenant_id 
    WHERE tenant_id IS NULL;
    
    ALTER TABLE public.wholesale_orders 
    ALTER COLUMN tenant_id SET NOT NULL;
    
    ALTER TABLE public.wholesale_orders 
    ADD CONSTRAINT fk_wholesale_orders_tenant 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
    
    CREATE INDEX idx_wholesale_orders_tenant_id ON public.wholesale_orders(tenant_id);
    
    RAISE NOTICE 'Added tenant_id to wholesale_orders';
  END IF;

  -- ============================================================================
  -- 5. WHOLESALE_DELIVERIES (inherits from wholesale_orders)
  -- ============================================================================
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'wholesale_deliveries' 
    AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.wholesale_deliveries 
    ADD COLUMN tenant_id UUID;
    
    -- Try to inherit from wholesale_orders first
    UPDATE public.wholesale_deliveries d
    SET tenant_id = (
      SELECT o.tenant_id 
      FROM public.wholesale_orders o 
      WHERE o.id = d.order_id 
      LIMIT 1
    )
    WHERE tenant_id IS NULL AND order_id IS NOT NULL;
    
    -- Fallback to first tenant for remaining
    UPDATE public.wholesale_deliveries 
    SET tenant_id = v_first_tenant_id 
    WHERE tenant_id IS NULL;
    
    ALTER TABLE public.wholesale_deliveries 
    ALTER COLUMN tenant_id SET NOT NULL;
    
    ALTER TABLE public.wholesale_deliveries 
    ADD CONSTRAINT fk_wholesale_deliveries_tenant 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
    
    CREATE INDEX idx_wholesale_deliveries_tenant_id ON public.wholesale_deliveries(tenant_id);
    
    RAISE NOTICE 'Added tenant_id to wholesale_deliveries';
  END IF;

END $$;

-- ============================================================================
-- ENABLE RLS AND ADD POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.disposable_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_deliveries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS tenant_isolation_disposable_menus ON public.disposable_menus;
DROP POLICY IF EXISTS tenant_isolation_wholesale_clients ON public.wholesale_clients;
DROP POLICY IF EXISTS tenant_isolation_wholesale_inventory ON public.wholesale_inventory;
DROP POLICY IF EXISTS tenant_isolation_wholesale_orders ON public.wholesale_orders;
DROP POLICY IF EXISTS tenant_isolation_wholesale_deliveries ON public.wholesale_deliveries;

-- Create tenant isolation policies
CREATE POLICY tenant_isolation_disposable_menus ON public.disposable_menus
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY tenant_isolation_wholesale_clients ON public.wholesale_clients
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY tenant_isolation_wholesale_inventory ON public.wholesale_inventory
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY tenant_isolation_wholesale_orders ON public.wholesale_orders
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY tenant_isolation_wholesale_deliveries ON public.wholesale_deliveries
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users 
      WHERE user_id = auth.uid()
    )
  );
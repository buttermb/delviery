-- Fix deliveries table missing tenant_id
-- Based on audit finding 1.1

DO $$ 
BEGIN
  -- 1. Add tenant_id to deliveries if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.deliveries ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    
    -- 2. Create index
    CREATE INDEX IF NOT EXISTS idx_deliveries_tenant_id ON public.deliveries(tenant_id);
    
    -- 3. Backfill data from orders
    UPDATE public.deliveries d
    SET tenant_id = o.tenant_id
    FROM public.orders o
    WHERE d.order_id = o.id
    AND d.tenant_id IS NULL;
    
    -- 4. Enable RLS (ensure it is enabled)
    ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
    
    -- 5. Update/Add RLS policies
    
    -- Drop old policy if it exists to avoid conflicts or if it was insufficient
    DROP POLICY IF EXISTS "Users can view own deliveries" ON public.deliveries;
    
    -- Re-create with tenant isolation + user check
    CREATE POLICY "Users can view own deliveries"
      ON public.deliveries FOR SELECT
      USING (
        (auth.uid() = courier_id) OR -- Courier can see their assignments
        (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid())) OR -- Customer can see their delivery
        (
          -- Tenant admins can see deliveries for their tenant
          tenant_id IN (
            SELECT tenant_id FROM public.tenant_users
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin', 'dispatcher')
          )
        )
      );
      
      -- Policy for couriers to update their deliveries
      DROP POLICY IF EXISTS "Couriers can update assigned deliveries" ON public.deliveries;
      CREATE POLICY "Couriers can update assigned deliveries"
        ON public.deliveries FOR UPDATE
        USING (auth.uid() = courier_id);

  END IF;
END $$;


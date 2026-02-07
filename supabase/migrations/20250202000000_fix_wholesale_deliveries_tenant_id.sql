-- ============================================================================
-- FIX: Add tenant_id to wholesale_deliveries (missing from previous migrations)
-- ============================================================================
-- This migration ensures wholesale_deliveries has tenant_id for multi-tenant isolation
-- The tenant_id should be inherited from the related wholesale_order
-- ============================================================================

DO $$ 
BEGIN
    -- Check if wholesale_deliveries table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wholesale_deliveries') THEN
        -- Check if tenant_id column already exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'wholesale_deliveries' 
            AND column_name = 'tenant_id'
        ) THEN
            -- Add tenant_id column (nullable first, then populate)
            ALTER TABLE public.wholesale_deliveries 
            ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
            
            -- Populate tenant_id from related wholesale_order
            UPDATE public.wholesale_deliveries d
            SET tenant_id = (
                SELECT o.tenant_id 
                FROM public.wholesale_orders o 
                WHERE o.id = d.order_id 
                LIMIT 1
            )
            WHERE tenant_id IS NULL;
            
            -- If wholesale_orders don't have tenant_id yet, use wholesale_clients
            UPDATE public.wholesale_deliveries d
            SET tenant_id = (
                SELECT c.tenant_id 
                FROM public.wholesale_orders o
                JOIN public.wholesale_clients c ON c.id = o.client_id
                WHERE o.id = d.order_id 
                LIMIT 1
            )
            WHERE tenant_id IS NULL;
            
            -- Create index for performance
            CREATE INDEX IF NOT EXISTS idx_wholesale_deliveries_tenant_id 
            ON public.wholesale_deliveries(tenant_id);
            
            RAISE NOTICE 'Added tenant_id column to wholesale_deliveries and populated from orders';
        ELSE
            RAISE NOTICE 'wholesale_deliveries.tenant_id already exists';
        END IF;
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.wholesale_deliveries.tenant_id IS 'Tenant isolation - inherited from wholesale_order for multi-tenant security';



-- ============================================================================
-- Add tenant_id to wholesale_runners for multi-tenant isolation
-- ============================================================================
-- This ensures runners are properly isolated per tenant

-- Add tenant_id column to wholesale_runners
DO $$ 
BEGIN
    -- Check if tenant_id column doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'wholesale_runners' 
        AND column_name = 'tenant_id'
    ) THEN
        -- Add tenant_id column
        ALTER TABLE public.wholesale_runners 
        ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
        
        -- If there are existing runners without tenant_id, they would need manual assignment
        -- For now, we'll leave them NULL until manually assigned
        
        -- Create index for performance
        CREATE INDEX IF NOT EXISTS idx_wholesale_runners_tenant_id 
        ON public.wholesale_runners(tenant_id);
        
        RAISE NOTICE 'Added tenant_id column to wholesale_runners';
    ELSE
        RAISE NOTICE 'wholesale_runners.tenant_id already exists';
    END IF;
END $$;

-- Add RLS policies for wholesale_runners if they don't exist
DO $$
BEGIN
    -- Only add policies if they don't already exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'wholesale_runners' 
        AND policyname = 'Tenants can view their runners'
    ) THEN
        CREATE POLICY "Tenants can view their runners"
          ON public.wholesale_runners
          FOR SELECT
          USING (
            tenant_id IN (
              SELECT tu.tenant_id 
              FROM public.tenant_users tu 
              WHERE tu.user_id = auth.uid()
            )
          );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'wholesale_runners' 
        AND policyname = 'Tenants can manage their runners'
    ) THEN
        CREATE POLICY "Tenants can manage their runners"
          ON public.wholesale_runners
          FOR ALL
          USING (
            tenant_id IN (
              SELECT tu.tenant_id 
              FROM public.tenant_users tu 
              WHERE tu.user_id = auth.uid()
            )
          )
          WITH CHECK (
            tenant_id IN (
              SELECT tu.tenant_id 
              FROM public.tenant_users tu 
              WHERE tu.user_id = auth.uid()
            )
          );
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.wholesale_runners.tenant_id IS 'Tenant isolation for multi-tenant security';

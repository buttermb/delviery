-- Add tenant_id to vendors table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.vendors ADD COLUMN tenant_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
        
        -- Backfill tenant_id from account_id (assuming they map 1:1 for now or account_id IS the tenant_id concept in this system)
        -- Based on the schema I saw, account_id seems to be the main identifier. 
        -- If the codebase is using "tenant_id" in queries, it likely expects this column to exist and match account_id.
        UPDATE public.vendors SET tenant_id = account_id WHERE tenant_id IS NULL;

        ALTER TABLE public.vendors ALTER COLUMN tenant_id SET NOT NULL;
        
        -- Add index
        CREATE INDEX IF NOT EXISTS idx_vendors_tenant_id ON public.vendors(tenant_id);
    END IF;
END $$;

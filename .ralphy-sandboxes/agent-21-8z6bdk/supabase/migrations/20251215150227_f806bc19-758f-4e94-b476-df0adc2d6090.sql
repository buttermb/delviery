-- Add tenant_id column to locations table (currently uses account_id)
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Create index for tenant filtering
CREATE INDEX IF NOT EXISTS idx_locations_tenant_id ON public.locations(tenant_id);

-- Add tenant_id column to deliveries table
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Create index for tenant filtering
CREATE INDEX IF NOT EXISTS idx_deliveries_tenant_id ON public.deliveries(tenant_id);

-- Update existing locations records to set tenant_id from account_id relationship
UPDATE public.locations l
SET tenant_id = a.tenant_id
FROM public.accounts a
WHERE l.account_id = a.id
AND l.tenant_id IS NULL;

-- Update existing deliveries records to set tenant_id from courier relationship
UPDATE public.deliveries d
SET tenant_id = c.tenant_id
FROM public.couriers c
WHERE d.courier_id = c.id
AND d.tenant_id IS NULL;
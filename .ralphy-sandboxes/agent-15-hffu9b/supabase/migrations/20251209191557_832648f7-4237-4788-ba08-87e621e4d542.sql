-- Add tenant_id to inventory_alerts table and create RLS policies
-- This fixes the security vulnerability where alerts could leak across tenants

-- 1. Add tenant_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'inventory_alerts' 
        AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE public.inventory_alerts ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
    END IF;
END $$;

-- 2. Backfill tenant_id from product relationship
UPDATE public.inventory_alerts ia
SET tenant_id = p.tenant_id
FROM public.products p
WHERE ia.product_id = p.id
AND ia.tenant_id IS NULL;

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_tenant_id ON public.inventory_alerts(tenant_id);

-- 4. Enable RLS if not already enabled
ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Tenants can view own inventory alerts" ON public.inventory_alerts;
DROP POLICY IF EXISTS "Tenants can manage own inventory alerts" ON public.inventory_alerts;

-- 6. Create RLS policies for tenant isolation
CREATE POLICY "Tenants can view own inventory alerts" 
ON public.inventory_alerts 
FOR SELECT 
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.tenant_users 
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

CREATE POLICY "Tenants can manage own inventory alerts" 
ON public.inventory_alerts 
FOR ALL 
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.tenant_users 
        WHERE user_id = auth.uid() AND status = 'active'
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM public.tenant_users 
        WHERE user_id = auth.uid() AND status = 'active'
    )
);
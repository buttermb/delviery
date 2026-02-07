-- Add tenant_id column to wholesale_payments table
ALTER TABLE public.wholesale_payments
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Populate tenant_id from related wholesale_clients
UPDATE public.wholesale_payments wp
SET tenant_id = wc.tenant_id
FROM public.wholesale_clients wc
WHERE wp.client_id = wc.id
AND wp.tenant_id IS NULL;

-- Create index for tenant_id
CREATE INDEX IF NOT EXISTS idx_wholesale_payments_tenant_id ON public.wholesale_payments(tenant_id);

-- Add RLS policy for tenant isolation
DROP POLICY IF EXISTS "Tenant isolation for wholesale_payments" ON public.wholesale_payments;
CREATE POLICY "Tenant isolation for wholesale_payments"
  ON public.wholesale_payments FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.tenant_users 
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.tenant_users 
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Add comment for documentation
COMMENT ON COLUMN public.wholesale_payments.tenant_id IS 'Foreign key to tenants table for multi-tenant isolation';
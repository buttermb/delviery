-- P1 Fixes Migration: Soft delete, duplicate prevention, timezone support

-- 1. Add soft delete columns to wholesale_clients
ALTER TABLE public.wholesale_clients 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Add soft delete columns to customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Add soft delete columns to crm_clients
ALTER TABLE public.crm_clients 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 4. Add timezone to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York';

-- 5. Add indexes for soft delete queries (exclude deleted records efficiently)
CREATE INDEX IF NOT EXISTS idx_wholesale_clients_active 
ON public.wholesale_clients(tenant_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_active 
ON public.customers(tenant_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_clients_active 
ON public.crm_clients(account_id) WHERE deleted_at IS NULL;

-- 6. Add unique constraint for duplicate prevention (only for active clients)
-- Using partial unique index to allow duplicates among deleted records
CREATE UNIQUE INDEX IF NOT EXISTS idx_wholesale_clients_unique_email 
ON public.wholesale_clients(tenant_id, LOWER(email)) 
WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wholesale_clients_unique_phone 
ON public.wholesale_clients(tenant_id, phone) 
WHERE deleted_at IS NULL AND phone IS NOT NULL;

-- 7. Add status transition timestamps to wholesale_orders if not exists
ALTER TABLE public.wholesale_orders 
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT NULL;

-- 8. Create function to soft delete a client
CREATE OR REPLACE FUNCTION public.soft_delete_wholesale_client(
  p_client_id UUID,
  p_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE wholesale_clients
  SET deleted_at = NOW()
  WHERE id = p_client_id
    AND tenant_id = p_tenant_id
    AND deleted_at IS NULL;
  
  RETURN FOUND;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.soft_delete_wholesale_client(UUID, UUID) TO authenticated;

-- 9. Create function to restore a soft-deleted client
CREATE OR REPLACE FUNCTION public.restore_wholesale_client(
  p_client_id UUID,
  p_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE wholesale_clients
  SET deleted_at = NULL
  WHERE id = p_client_id
    AND tenant_id = p_tenant_id
    AND deleted_at IS NOT NULL;
  
  RETURN FOUND;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.restore_wholesale_client(UUID, UUID) TO authenticated;

-- 10. Add comment for documentation
COMMENT ON COLUMN public.wholesale_clients.deleted_at IS 'Soft delete timestamp - NULL means active, non-NULL means archived';
COMMENT ON COLUMN public.customers.deleted_at IS 'Soft delete timestamp - NULL means active, non-NULL means archived';
COMMENT ON COLUMN public.tenants.timezone IS 'Tenant timezone for date/time display (IANA timezone name)';

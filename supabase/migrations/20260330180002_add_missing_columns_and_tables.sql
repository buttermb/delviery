-- Add missing columns and tables referenced by the frontend
-- Fixes 400/404 errors on dashboard queries

-- 1. deliveries.status - queried as status=eq.in_transit
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- 2. products.status - queried as status=eq.active (table had is_active boolean)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
UPDATE public.products SET status = CASE WHEN is_active = true THEN 'active' ELSE 'inactive' END
WHERE status = 'active' AND is_active = false;

-- 3. products.cost - queried via order_items join product:products(cost)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost numeric;
UPDATE public.products SET cost = cost_per_unit WHERE cost IS NULL AND cost_per_unit IS NOT NULL;

-- 4. activity_log table - queried for recent activity feed
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_log_tenant_read ON public.activity_log FOR SELECT
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
  ));
CREATE INDEX IF NOT EXISTS idx_activity_log_tenant_created ON public.activity_log(tenant_id, created_at DESC);

-- 5. FK from wholesale_orders.runner_id to wholesale_runners
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
    AND table_name = 'wholesale_orders'
    AND constraint_name = 'wholesale_orders_runner_id_fkey'
  ) THEN
    ALTER TABLE public.wholesale_orders
    ADD CONSTRAINT wholesale_orders_runner_id_fkey
    FOREIGN KEY (runner_id) REFERENCES public.wholesale_runners(id);
  END IF;
END $$;

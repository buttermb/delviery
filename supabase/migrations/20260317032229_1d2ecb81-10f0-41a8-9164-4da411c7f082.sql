
-- Step 1: Add missing columns to couriers
ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS vehicle_year integer,
  ADD COLUMN IF NOT EXISTS vehicle_color text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz,
  ADD COLUMN IF NOT EXISTS suspend_reason text;

-- Step 2: Create delivery_zones table
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_tenant_id ON public.delivery_zones(tenant_id);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view zones" ON public.delivery_zones;
CREATE POLICY "Tenant members can view zones"
  ON public.delivery_zones FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant members can manage zones" ON public.delivery_zones;
CREATE POLICY "Tenant members can manage zones"
  ON public.delivery_zones FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Step 3: Add zone_id FK to couriers
ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.delivery_zones(id);

-- Step 4: Backfill status from is_active
UPDATE public.couriers SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END WHERE status = 'pending';

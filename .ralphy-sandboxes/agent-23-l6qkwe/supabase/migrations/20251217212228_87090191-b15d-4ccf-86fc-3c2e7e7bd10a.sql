-- Phase 5: Part 2 - New tables (fixed)

-- Add tenant_id to existing inventory_transfers table
ALTER TABLE public.inventory_transfers ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Update existing rows to have tenant_id from account mapping if possible
UPDATE public.inventory_transfers it
SET tenant_id = a.tenant_id
FROM public.accounts a
WHERE it.account_id = a.id AND it.tenant_id IS NULL;

-- 5.4 Multi-Location Inventory (new table)
CREATE TABLE IF NOT EXISTS public.location_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity INTEGER DEFAULT 0 CHECK (reserved_quantity >= 0),
  reorder_point INTEGER DEFAULT 10,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_location_inventory_tenant ON public.location_inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_location_inventory_location ON public.location_inventory(location_id);
CREATE INDEX IF NOT EXISTS idx_location_inventory_product ON public.location_inventory(product_id);

ALTER TABLE public.location_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for location_inventory" ON public.location_inventory;
CREATE POLICY "Tenant isolation for location_inventory" ON public.location_inventory
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

-- 5.5 Cannabis Tax System
CREATE TABLE IF NOT EXISTS public.tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tax_type TEXT NOT NULL CHECK (tax_type IN ('sales', 'excise', 'local', 'state', 'cannabis_excise')),
  name TEXT NOT NULL,
  rate NUMERIC NOT NULL CHECK (rate >= 0 AND rate <= 100),
  applies_to TEXT[] DEFAULT ARRAY['all'],
  effective_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_rates_tenant ON public.tax_rates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tax_rates_active ON public.tax_rates(is_active, effective_date);

ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for tax_rates" ON public.tax_rates;
CREATE POLICY "Tenant isolation for tax_rates" ON public.tax_rates
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));
-- Create inventory_categories table for normalizing wholesale inventory categories
-- Replaces free-text category column on wholesale_inventory with a proper lookup table

CREATE TABLE IF NOT EXISTS public.inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

-- Enable RLS
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies: tenant-scoped access
CREATE POLICY "Users can view inventory categories in their tenant"
  ON public.inventory_categories FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert inventory categories in their tenant"
  ON public.inventory_categories FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update inventory categories in their tenant"
  ON public.inventory_categories FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete inventory categories in their tenant"
  ON public.inventory_categories FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

-- Add category_id FK to wholesale_inventory
ALTER TABLE public.wholesale_inventory
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.inventory_categories(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_categories_tenant
  ON public.inventory_categories(tenant_id);

CREATE INDEX IF NOT EXISTS idx_inventory_categories_slug
  ON public.inventory_categories(tenant_id, slug);

CREATE INDEX IF NOT EXISTS idx_inventory_categories_sort
  ON public.inventory_categories(tenant_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_inventory_categories_active
  ON public.inventory_categories(tenant_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_wholesale_inventory_category_id
  ON public.wholesale_inventory(category_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_inventory_categories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inventory_categories_updated_at
  BEFORE UPDATE ON public.inventory_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_inventory_categories_updated_at();

-- Seed default categories per tenant using existing wholesale_inventory category values
-- This creates inventory_categories rows from distinct category values already in use
INSERT INTO public.inventory_categories (tenant_id, name, slug, sort_order)
SELECT DISTINCT
  wi.tenant_id,
  wi.category,
  lower(regexp_replace(wi.category, '[^a-zA-Z0-9]+', '-', 'g')),
  ROW_NUMBER() OVER (PARTITION BY wi.tenant_id ORDER BY wi.category)::INTEGER
FROM public.wholesale_inventory wi
WHERE wi.category IS NOT NULL
  AND wi.category != ''
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- Backfill category_id on wholesale_inventory from the seeded categories
UPDATE public.wholesale_inventory wi
SET category_id = ic.id
FROM public.inventory_categories ic
WHERE wi.tenant_id = ic.tenant_id
  AND lower(regexp_replace(wi.category, '[^a-zA-Z0-9]+', '-', 'g')) = ic.slug
  AND wi.category_id IS NULL;

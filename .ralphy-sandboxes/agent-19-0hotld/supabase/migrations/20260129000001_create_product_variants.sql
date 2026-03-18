-- Create product_variants table for size, weight, strain options
-- Migration: 20260129000001_create_product_variants.sql

-- Create product_variants table with tenant isolation
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  -- Variant details
  name text NOT NULL, -- e.g., "1/8 oz", "1g", "Blue Dream"
  variant_type text NOT NULL CHECK (variant_type IN ('size', 'weight', 'strain')),
  sku text, -- Optional variant-specific SKU

  -- Pricing (overrides product price when set)
  price numeric(10,2),
  cost_per_unit numeric(10,2),
  wholesale_price numeric(10,2),
  retail_price numeric(10,2),

  -- Inventory tracking
  available_quantity integer DEFAULT 0,
  low_stock_alert integer DEFAULT 10,

  -- Sorting and display
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,

  -- Cannabis-specific fields for strain variants
  thc_percent numeric(5,2),
  cbd_percent numeric(5,2),
  strain_type text CHECK (strain_type IS NULL OR strain_type IN ('indica', 'sativa', 'hybrid', 'cbd')),

  -- Weight for weight-based variants (in grams)
  weight_grams numeric(10,3),

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS (REQUIRED)
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- RLS Policies with tenant isolation
CREATE POLICY "Tenant users can view product variants" ON public.product_variants
  FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant users can manage product variants" ON public.product_variants
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Indexes for performance
CREATE INDEX idx_product_variants_tenant ON public.product_variants(tenant_id);
CREATE INDEX idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX idx_product_variants_type ON public.product_variants(variant_type);
CREATE INDEX idx_product_variants_active ON public.product_variants(is_active) WHERE is_active = true;
CREATE UNIQUE INDEX idx_product_variants_sku ON public.product_variants(tenant_id, sku) WHERE sku IS NOT NULL;

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION public.update_product_variants_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_product_variants_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;

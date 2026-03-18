-- ============================================================================
-- PRODUCTS TABLE: Add all missing columns for full-field support
-- ============================================================================
-- Consolidates columns referenced in the codebase (useProduct.ts,
-- ProductManagement.tsx, ProductCatalogPage.tsx, etc.) that are not yet
-- present in the products table.
-- Uses ADD COLUMN IF NOT EXISTS so this migration is safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Categorization & branding
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT;

-- ---------------------------------------------------------------------------
-- 2. Measurement
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'g',
  ADD COLUMN IF NOT EXISTS weight NUMERIC(10,3);

-- ---------------------------------------------------------------------------
-- 3. Visibility & feature flags
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- ---------------------------------------------------------------------------
-- 4. Tagging & search
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- ---------------------------------------------------------------------------
-- 5. Compliance & tracking IDs
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS metrc_id TEXT;

-- metrc_retail_id, exclude_from_discounts, minimum_price may already exist
-- from earlier migrations — IF NOT EXISTS makes this safe
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS metrc_retail_id TEXT,
  ADD COLUMN IF NOT EXISTS exclude_from_discounts BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS minimum_price NUMERIC(10,2) DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 6. Barcode image
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode_image_url TEXT;

-- ---------------------------------------------------------------------------
-- 7. Timestamps
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill updated_at from created_at where NULL
UPDATE public.products
SET updated_at = COALESCE(created_at, now())
WHERE updated_at IS NULL;

-- ---------------------------------------------------------------------------
-- 8. Soft-delete columns (may already exist)
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 9. Auto-update trigger for updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_products_updated_at()
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

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_products_updated_at();

-- ---------------------------------------------------------------------------
-- 10. Indexes for new columns
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products (is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_is_featured ON public.products (is_featured)
  WHERE is_featured = true;

CREATE INDEX IF NOT EXISTS idx_products_subcategory ON public.products (subcategory)
  WHERE subcategory IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products (brand)
  WHERE brand IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_metrc_id ON public.products (metrc_id)
  WHERE metrc_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_tags ON public.products USING GIN (tags)
  WHERE tags IS NOT NULL AND tags != '{}';

CREATE INDEX IF NOT EXISTS idx_products_updated_at ON public.products (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_archived_at ON public.products (archived_at)
  WHERE archived_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON public.products (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 11. Comments
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.products.subcategory IS 'Product sub-category (e.g., pre-rolls, tinctures)';
COMMENT ON COLUMN public.products.brand IS 'Brand or manufacturer name';
COMMENT ON COLUMN public.products.unit IS 'Unit of measurement (g, oz, ml, each)';
COMMENT ON COLUMN public.products.weight IS 'Product weight in the specified unit';
COMMENT ON COLUMN public.products.is_active IS 'Whether the product is active and available for sale';
COMMENT ON COLUMN public.products.is_featured IS 'Whether the product is featured/promoted';
COMMENT ON COLUMN public.products.tags IS 'Array of searchable tags';
COMMENT ON COLUMN public.products.metrc_id IS 'METRC package tag ID for compliance tracking';
COMMENT ON COLUMN public.products.metrc_retail_id IS 'METRC retail ID for compliance tracking';
COMMENT ON COLUMN public.products.exclude_from_discounts IS 'Whether this product is excluded from discount codes';
COMMENT ON COLUMN public.products.minimum_price IS 'Minimum allowed sale price for compliance';
COMMENT ON COLUMN public.products.barcode_image_url IS 'URL to rendered barcode image';
COMMENT ON COLUMN public.products.updated_at IS 'Last modification timestamp, auto-updated by trigger';
COMMENT ON COLUMN public.products.archived_at IS 'Soft-archive timestamp; NULL means active';
COMMENT ON COLUMN public.products.deleted_at IS 'Soft-delete timestamp; NULL means not deleted';

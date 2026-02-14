-- ============================================
-- PRODUCT BARCODE & MENU AUTO-SYNC MVP
-- Migration: Add barcode_image_url, menu_visibility, and SKU sequence tracking
-- ============================================

-- 1. Add barcode_image_url column to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode_image_url TEXT;

-- 2. Add menu_visibility column to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS menu_visibility BOOLEAN DEFAULT true;

-- 3. Create product_sku_sequences table to track SKU counters per category
CREATE TABLE IF NOT EXISTS public.product_sku_sequences (
  category TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  last_number INTEGER DEFAULT 0 NOT NULL,
  prefix TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (category, tenant_id)
);

-- Add index for faster tenant lookups
CREATE INDEX IF NOT EXISTS idx_product_sku_sequences_tenant_id 
  ON public.product_sku_sequences(tenant_id);

-- 4. Ensure sku column exists and add index
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku TEXT;

CREATE INDEX IF NOT EXISTS idx_products_sku 
  ON public.products(sku) 
  WHERE sku IS NOT NULL;

-- 5. Add index on products.menu_visibility for menu queries
CREATE INDEX IF NOT EXISTS idx_products_menu_visibility 
  ON public.products(menu_visibility) 
  WHERE menu_visibility = true;

-- 6. Note: SKU sequences will be created automatically per tenant when first product is created
-- No need to pre-populate since sequences are tenant-specific

-- 7. Enable RLS on product_sku_sequences
ALTER TABLE public.product_sku_sequences ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policy: Users can only see sequences for their tenant
CREATE POLICY "Users can view SKU sequences for their tenant"
  ON public.product_sku_sequences
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- 9. RLS Policy: Users can update sequences for their tenant
CREATE POLICY "Users can update SKU sequences for their tenant"
  ON public.product_sku_sequences
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- 10. RLS Policy: Users can insert sequences for their tenant
CREATE POLICY "Users can insert SKU sequences for their tenant"
  ON public.product_sku_sequences
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- 11. Set menu_visibility based on current stock for existing products
-- 11. Set menu_visibility based on current stock for existing products (SKIPPED: available_quantity missing)
-- UPDATE public.products
-- SET menu_visibility = CASE 
--   WHEN available_quantity > 0 THEN true
--   ELSE false
-- END
-- WHERE menu_visibility IS NULL;

-- 12. Add comment for documentation
COMMENT ON COLUMN public.products.barcode_image_url IS 'URL to barcode image stored in Supabase Storage';
COMMENT ON COLUMN public.products.menu_visibility IS 'Whether product should appear in disposable menus (auto-updated based on stock)';
COMMENT ON TABLE public.product_sku_sequences IS 'Tracks SKU sequence numbers per category for auto-generation';


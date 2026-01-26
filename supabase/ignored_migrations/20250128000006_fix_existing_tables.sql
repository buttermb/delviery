-- ============================================================================
-- FIX EXISTING TABLES: inventory_batches and products
-- ============================================================================
-- Phase 1.2: Add missing columns to existing tables
-- ============================================================================

-- ============================================================================
-- INVENTORY_BATCHES TABLE - Add missing columns
-- ============================================================================
DO $$
BEGIN
  -- Add quantity column (for backward compatibility, though code should use quantity_lbs)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'inventory_batches' 
    AND column_name = 'quantity'
  ) THEN
    ALTER TABLE public.inventory_batches 
      ADD COLUMN quantity NUMERIC DEFAULT 0;
    RAISE NOTICE 'Added quantity column to inventory_batches';
  END IF;

  -- Add location column (for backward compatibility, though code should use warehouse_location)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'inventory_batches' 
    AND column_name = 'location'
  ) THEN
    ALTER TABLE public.inventory_batches 
      ADD COLUMN location TEXT;
    RAISE NOTICE 'Added location column to inventory_batches';
  END IF;

  -- Add notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'inventory_batches' 
    AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.inventory_batches 
      ADD COLUMN notes TEXT;
    RAISE NOTICE 'Added notes column to inventory_batches';
  END IF;

  -- Ensure tenant_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'inventory_batches' 
    AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.inventory_batches 
      ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_inventory_batches_tenant_id ON public.inventory_batches(tenant_id);
    RAISE NOTICE 'Added tenant_id column to inventory_batches';
  END IF;
END $$;

-- ============================================================================
-- PRODUCTS TABLE - Add category_id column
-- ============================================================================
DO $$
BEGIN
  -- Add category_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'products' 
    AND column_name = 'category_id'
  ) THEN
    ALTER TABLE public.products 
      ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
    RAISE NOTICE 'Added category_id column to products';
  END IF;
END $$;

-- Comments
COMMENT ON COLUMN public.inventory_batches.quantity IS 'Quantity in lbs (legacy column, prefer quantity_lbs)';
COMMENT ON COLUMN public.inventory_batches.location IS 'Storage location (legacy column, prefer warehouse_location)';
COMMENT ON COLUMN public.inventory_batches.notes IS 'Additional notes about the batch';
COMMENT ON COLUMN public.products.category_id IS 'Foreign key to categories table for product organization';


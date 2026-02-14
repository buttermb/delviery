-- Products Soft Delete Migration
-- Adds deleted_at column for soft delete/archive functionality

-- 1. Add soft delete column to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Add index for efficient queries on active products
CREATE INDEX IF NOT EXISTS idx_products_active
ON public.products(tenant_id) WHERE deleted_at IS NULL;

-- 3. Add index for archived products queries
CREATE INDEX IF NOT EXISTS idx_products_archived
ON public.products(tenant_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- 4. Create function to archive (soft delete) a product
CREATE OR REPLACE FUNCTION public.archive_product(
  p_product_id UUID,
  p_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products
  SET deleted_at = NOW()
  WHERE id = p_product_id
    AND tenant_id = p_tenant_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.archive_product(UUID, UUID) TO authenticated;

-- 5. Create function to restore an archived product
CREATE OR REPLACE FUNCTION public.restore_product(
  p_product_id UUID,
  p_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products
  SET deleted_at = NULL
  WHERE id = p_product_id
    AND tenant_id = p_tenant_id
    AND deleted_at IS NOT NULL;

  RETURN FOUND;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.restore_product(UUID, UUID) TO authenticated;

-- 6. Add documentation comment
COMMENT ON COLUMN public.products.deleted_at IS 'Soft delete timestamp - NULL means active, non-NULL means archived';

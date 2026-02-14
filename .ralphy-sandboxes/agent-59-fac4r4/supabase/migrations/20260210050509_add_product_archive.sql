-- Migration: Add archived_at field to products table for soft-delete functionality
-- Products can be archived instead of deleted to preserve order history and analytics

-- Add archived_at column (null = active, timestamp = archived)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient filtering of archived products
CREATE INDEX IF NOT EXISTS idx_products_archived_at ON public.products(archived_at);

-- Create index for filtering active (non-archived) products
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(tenant_id) WHERE archived_at IS NULL;

-- Add comment describing the column
COMMENT ON COLUMN public.products.archived_at IS 'Timestamp when product was archived. NULL means product is active. Archived products retain history but are hidden from active lists and ordering.';

-- Function to archive a product and sync with menus
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
  -- Update product archived_at timestamp
  UPDATE public.products
  SET archived_at = NOW()
  WHERE id = p_product_id
    AND tenant_id = p_tenant_id
    AND archived_at IS NULL;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Remove product from all active menus
  DELETE FROM public.menu_products
  WHERE product_id = p_product_id;

  -- Also update menu_visibility to false
  UPDATE public.products
  SET menu_visibility = FALSE
  WHERE id = p_product_id
    AND tenant_id = p_tenant_id;

  RETURN TRUE;
END;
$$;

-- Function to unarchive a product
CREATE OR REPLACE FUNCTION public.unarchive_product(
  p_product_id UUID,
  p_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET archived_at = NULL
  WHERE id = p_product_id
    AND tenant_id = p_tenant_id
    AND archived_at IS NOT NULL;

  RETURN FOUND;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.archive_product(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_product(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.unarchive_product(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unarchive_product(UUID, UUID) TO service_role;

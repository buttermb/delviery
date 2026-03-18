-- Atomic stock deduction that returns false if insufficient stock.
-- Unlike decrement_stock (which blindly clamps to 0), this function
-- only deducts when stock_quantity >= p_quantity, providing a safe
-- check-and-deduct in a single atomic UPDATE.

CREATE OR REPLACE FUNCTION public.deduct_stock(
  p_product_id UUID,
  p_quantity INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected INTEGER;
BEGIN
  -- Guard against negative or zero quantities
  IF p_quantity <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.products
  SET
    stock_quantity = stock_quantity - p_quantity,
    updated_at = NOW()
  WHERE id = p_product_id
    AND stock_quantity >= p_quantity;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected > 0;
END;
$$;

-- Allow storefront (anon) and admin (authenticated) callers
GRANT EXECUTE ON FUNCTION public.deduct_stock(UUID, INTEGER) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.deduct_stock(UUID, INTEGER) IS
  'Atomically deducts stock for a product. Returns true if successful, false if insufficient stock.';

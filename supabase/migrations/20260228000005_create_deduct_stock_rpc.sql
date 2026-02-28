-- Atomic stock deduction that returns false if insufficient stock.
-- Unlike decrement_stock (which blindly clamps to 0), this function
-- only deducts when stock_quantity >= p_quantity, providing a safe
-- check-and-deduct in a single atomic UPDATE.

CREATE OR REPLACE FUNCTION deduct_stock(
  p_product_id UUID,
  p_quantity INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity - p_quantity
  WHERE id = p_product_id
  AND stock_quantity >= p_quantity;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;

COMMENT ON FUNCTION deduct_stock(UUID, INTEGER) IS
  'Atomically deducts stock for a product. Returns true if successful, false if insufficient stock.';

-- ============================================================================
-- next_order_number: Atomic order number generation for the orders table
-- ============================================================================
-- Returns the next sequential order number for a given tenant.
-- Uses advisory locks to prevent race conditions under concurrent access.
-- Starts from 1001 if no existing numeric order numbers are found.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.next_order_number(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- Advisory lock keyed on tenant_id prevents concurrent callers
  -- from receiving the same number
  PERFORM pg_advisory_xact_lock(hashtext('orders_' || p_tenant_id::text));

  SELECT COALESCE(MAX(order_number::INTEGER), 1000) + 1
  INTO next_num
  FROM orders
  WHERE tenant_id = p_tenant_id
    AND order_number ~ '^\d+$';

  RETURN next_num;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_order_number(UUID) TO authenticated;

COMMENT ON FUNCTION public.next_order_number IS
  'Returns the next sequential order number for a tenant (orders table). Uses advisory locks for concurrency safety.';

-- Add missing update_order_status RPC function
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id UUID,
  p_new_status TEXT,
  p_cancellation_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE unified_orders
  SET 
    status = p_new_status,
    updated_at = NOW(),
    cancelled_at = CASE WHEN p_new_status = 'cancelled' THEN NOW() ELSE cancelled_at END,
    cancellation_reason = COALESCE(p_cancellation_reason, cancellation_reason)
  WHERE id = p_order_id
    AND tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid());
END;
$$;

-- Create backward-compatible views for legacy code
CREATE OR REPLACE VIEW wholesale_orders_unified AS
SELECT * FROM unified_orders WHERE order_type = 'wholesale';

CREATE OR REPLACE VIEW menu_orders_unified AS
SELECT * FROM unified_orders WHERE order_type = 'menu';

CREATE OR REPLACE VIEW pos_orders_unified AS
SELECT * FROM unified_orders WHERE order_type = 'pos';

CREATE OR REPLACE VIEW retail_orders_unified AS
SELECT * FROM unified_orders WHERE order_type = 'retail';
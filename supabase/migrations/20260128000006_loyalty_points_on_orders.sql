-- Add loyalty points tracking to orders
-- Enables automatic loyalty point earning on order completion

-- Add loyalty_points_earned column to marketplace_orders
ALTER TABLE public.marketplace_orders
ADD COLUMN IF NOT EXISTS loyalty_points_earned INTEGER DEFAULT 0;

-- Add loyalty_points_redeemed column for tracking redemptions
ALTER TABLE public.marketplace_orders
ADD COLUMN IF NOT EXISTS loyalty_points_redeemed INTEGER DEFAULT 0;

-- Update the storefront_orders view to include loyalty points
DROP VIEW IF EXISTS public.storefront_orders;
CREATE VIEW public.storefront_orders AS
SELECT
  id,
  order_number,
  store_id,
  buyer_user_id as customer_id,
  COALESCE(customer_name, '') as customer_name,
  COALESCE(customer_email, '') as customer_email,
  status,
  payment_status,
  subtotal,
  COALESCE(tax, 0) as tax_amount,
  COALESCE(shipping_cost, 0) as delivery_fee,
  total_amount as total,
  shipping_address as delivery_address,
  COALESCE(loyalty_points_earned, 0) as loyalty_points_earned,
  COALESCE(loyalty_points_redeemed, 0) as loyalty_points_redeemed,
  created_at,
  updated_at
FROM public.marketplace_orders
WHERE store_id IS NOT NULL;

-- Create trigger to automatically award loyalty points on order completion
-- This serves as a fallback if webhook fails
CREATE OR REPLACE FUNCTION award_loyalty_on_order_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_points_earned INTEGER;
BEGIN
  -- Only trigger when payment_status changes to 'paid'
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN
    -- Only award if points haven't been awarded yet
    IF COALESCE(NEW.loyalty_points_earned, 0) = 0 THEN
      -- Award loyalty points using existing function
      SELECT add_marketplace_loyalty_points(
        NEW.store_id,
        NEW.customer_email,
        COALESCE(NEW.total_amount, 0)
      ) INTO v_points_earned;

      -- Update the order with earned points
      NEW.loyalty_points_earned := COALESCE(v_points_earned, 0);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_award_loyalty_on_paid ON public.marketplace_orders;
CREATE TRIGGER trg_award_loyalty_on_paid
  BEFORE UPDATE ON public.marketplace_orders
  FOR EACH ROW
  EXECUTE FUNCTION award_loyalty_on_order_paid();

-- Add index for loyalty queries
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_loyalty_points
  ON public.marketplace_orders(store_id, loyalty_points_earned)
  WHERE loyalty_points_earned > 0;

-- Comment on the new columns
COMMENT ON COLUMN public.marketplace_orders.loyalty_points_earned IS 'Loyalty points awarded to customer for this order';
COMMENT ON COLUMN public.marketplace_orders.loyalty_points_redeemed IS 'Loyalty points redeemed by customer on this order';

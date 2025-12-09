-- Drop the security definer view and recreate as regular view
DROP VIEW IF EXISTS public.storefront_orders;

CREATE VIEW public.storefront_orders 
WITH (security_invoker = true) AS
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
  created_at,
  updated_at
FROM public.marketplace_orders
WHERE store_id IS NOT NULL;
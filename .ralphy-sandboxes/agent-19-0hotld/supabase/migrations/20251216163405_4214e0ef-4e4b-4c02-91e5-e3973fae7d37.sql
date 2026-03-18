
-- Fix storefront_orders view - add security_invoker
DROP VIEW IF EXISTS public.storefront_orders;
CREATE VIEW public.storefront_orders 
WITH (security_invoker = true)
AS SELECT id, order_number, store_id, customer_id,
         COALESCE(customer_name, '') AS customer_name,
         COALESCE(customer_email, '') AS customer_email,
         COALESCE(customer_phone, '') AS customer_phone,
         status, payment_status, subtotal,
         COALESCE(tax_amount, 0) AS tax_amount,
         COALESCE(delivery_fee, 0) AS delivery_fee,
         total, delivery_address,
         delivery_notes, items, tracking_token, NULL::text AS stripe_session_id,
         NULL::text AS stripe_payment_intent_id, NULL::timestamptz AS paid_at, created_at, updated_at
   FROM marketplace_orders
   WHERE store_id IS NOT NULL;

GRANT SELECT ON public.storefront_orders TO authenticated;
GRANT SELECT ON public.storefront_orders TO anon;

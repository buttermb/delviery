-- Add store_id to marketplace_orders for storefront integration
ALTER TABLE public.marketplace_orders 
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.marketplace_stores(id);

-- Add customer display fields if missing
ALTER TABLE public.marketplace_orders 
ADD COLUMN IF NOT EXISTS customer_name TEXT;

ALTER TABLE public.marketplace_orders 
ADD COLUMN IF NOT EXISTS customer_email TEXT;

ALTER TABLE public.marketplace_orders 
ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Rename total_amount to total if needed (alias view)
-- Create index for store queries
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_store_id ON public.marketplace_orders(store_id);

-- Create or replace view for storefront orders
CREATE OR REPLACE VIEW public.storefront_orders AS
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
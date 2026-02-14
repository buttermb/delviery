-- Add order_source column to orders table to track where orders come from
-- Values: 'admin' (default), 'storefront', 'pos', 'menu', 'api'

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_source text NOT NULL DEFAULT 'admin'
CHECK (order_source IN ('admin', 'storefront', 'pos', 'menu', 'api'));

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders(tenant_id, order_source);

-- Comment for documentation
COMMENT ON COLUMN public.orders.order_source IS 'Origin of the order: admin, storefront, pos, menu, or api';

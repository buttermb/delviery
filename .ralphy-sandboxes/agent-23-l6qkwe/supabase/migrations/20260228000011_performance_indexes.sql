-- Performance indexes for common query patterns
-- Task: task-332 (floraiq-dy9.22)
--
-- marketplace_orders uses seller_tenant_id as the tenant identifier for storefront queries.
-- The column "visible_on_storefront" maps to menu_visibility on the products table.
-- Indexes that already exist and are NOT recreated:
--   - marketplace_order_items(order_id)     -> idx_marketplace_order_items_order
--   - customers(tenant_id, phone)           -> idx_customers_tenant_phone
--   - marketplace_stores(slug) UNIQUE       -> unique_store_slug constraint

-- 1. Orders by tenant + creation date (admin order lists, dashboards)
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller_created
  ON public.marketplace_orders (seller_tenant_id, created_at DESC);

-- 2. Orders by tenant + status (filtered order views)
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller_status
  ON public.marketplace_orders (seller_tenant_id, status);

-- 3. Orders by tenant + customer (customer order history)
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller_customer
  ON public.marketplace_orders (seller_tenant_id, customer_id);

-- 4. Products by tenant + storefront visibility (storefront product listings)
CREATE INDEX IF NOT EXISTS idx_products_tenant_menu_visibility
  ON public.products (tenant_id, menu_visibility);

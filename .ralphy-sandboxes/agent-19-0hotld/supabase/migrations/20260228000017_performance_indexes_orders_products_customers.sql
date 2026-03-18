-- Performance indexes for orders, products, and customers
-- Adds composite indexes for common query patterns identified in the codebase
-- All indexes use IF NOT EXISTS to be safely idempotent

-- =============================================================================
-- UNIFIED_ORDERS: Composite indexes for admin order list filtering & sorting
-- =============================================================================

-- Most common admin query: filter by tenant + status, sort by created_at
CREATE INDEX IF NOT EXISTS idx_unified_orders_tenant_status_created
  ON public.unified_orders (tenant_id, status, created_at DESC);

-- Payment reports: filter by tenant + payment_status
CREATE INDEX IF NOT EXISTS idx_unified_orders_tenant_payment_status
  ON public.unified_orders (tenant_id, payment_status);

-- Order number lookup within tenant
CREATE INDEX IF NOT EXISTS idx_unified_orders_tenant_order_number
  ON public.unified_orders (tenant_id, order_number);

-- Customer order history with tenant isolation
CREATE INDEX IF NOT EXISTS idx_unified_orders_tenant_customer_created
  ON public.unified_orders (tenant_id, customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

-- =============================================================================
-- PRODUCTS: Composite indexes for catalog browsing and inventory
-- =============================================================================

-- Category browsing within tenant
CREATE INDEX IF NOT EXISTS idx_products_tenant_category
  ON public.products (tenant_id, category);

-- Product name lookups and sorting within tenant
CREATE INDEX IF NOT EXISTS idx_products_tenant_name
  ON public.products (tenant_id, name);

-- =============================================================================
-- MARKETPLACE_ORDERS: Storefront query patterns
-- =============================================================================

-- Storefront order listing by store with date sorting
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_store_created
  ON public.marketplace_orders (store_id, created_at DESC);

-- Storefront order filtering by store + status
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_store_status
  ON public.marketplace_orders (store_id, status);

-- =============================================================================
-- UNIFIED_ORDER_ITEMS: Join performance for product order stats
-- =============================================================================

-- Product order stats: look up items by product with order join
CREATE INDEX IF NOT EXISTS idx_unified_order_items_product_order
  ON public.unified_order_items (product_id, order_id)
  WHERE product_id IS NOT NULL;

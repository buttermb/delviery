-- Migration: Add partial index on products table for low stock items
-- Purpose: Optimize queries that filter products with low stock (stock_quantity < 10)
-- This partial index will significantly improve query performance for queries like:
-- SELECT * FROM products WHERE stock_quantity < 10
-- Common use cases include inventory alerts, low stock reports, and reorder dashboards

-- Create partial index on stock_quantity where stock_quantity < 10
-- This index only indexes products with low stock, reducing index size and improving write performance
CREATE INDEX IF NOT EXISTS idx_products_low_stock
ON public.products(stock_quantity)
WHERE stock_quantity < 10;

-- Add a comment to document the index purpose
COMMENT ON INDEX idx_products_low_stock IS
'Partial index to optimize queries filtering products with low stock (stock_quantity < 10). Common for inventory alerts and reorder reports.';

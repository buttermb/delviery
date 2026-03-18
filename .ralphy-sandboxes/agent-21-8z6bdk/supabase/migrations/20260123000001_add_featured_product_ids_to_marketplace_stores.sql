-- Add featured_product_ids column to marketplace_stores
-- Stores an ordered array of product IDs to feature on the storefront homepage

ALTER TABLE marketplace_stores
ADD COLUMN IF NOT EXISTS featured_product_ids TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN marketplace_stores.featured_product_ids IS 'Ordered array of product IDs to display as featured on storefront';

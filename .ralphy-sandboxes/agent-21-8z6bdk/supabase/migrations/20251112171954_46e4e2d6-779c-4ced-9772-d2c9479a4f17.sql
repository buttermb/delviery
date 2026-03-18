-- Phase 1: Generate SKUs for products missing them using CTE approach
-- This migration ensures all existing products have valid SKUs and barcodes

-- Create a CTE to compute SKUs with row numbers, then update
WITH numbered_products AS (
  SELECT 
    id,
    category,
    tenant_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id, category ORDER BY created_at) as category_num,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at) as global_num
  FROM products
  WHERE sku IS NULL OR sku = '' OR barcode IS NULL OR barcode = ''
)
UPDATE products p
SET 
  sku = CASE 
    WHEN np.category = 'flower' THEN CONCAT('FLOW-', LPAD(np.category_num::text, 4, '0'))
    WHEN np.category = 'vapes' THEN CONCAT('VAPE-', LPAD(np.category_num::text, 4, '0'))
    WHEN np.category = 'edibles' THEN CONCAT('EDIB-', LPAD(np.category_num::text, 4, '0'))
    WHEN np.category = 'concentrates' THEN CONCAT('CONC-', LPAD(np.category_num::text, 4, '0'))
    ELSE CONCAT('PRD-', LPAD(np.global_num::text, 4, '0'))
  END,
  barcode = CASE 
    WHEN np.category = 'flower' THEN CONCAT('FLOW-', LPAD(np.category_num::text, 4, '0'))
    WHEN np.category = 'vapes' THEN CONCAT('VAPE-', LPAD(np.category_num::text, 4, '0'))
    WHEN np.category = 'edibles' THEN CONCAT('EDIB-', LPAD(np.category_num::text, 4, '0'))
    WHEN np.category = 'concentrates' THEN CONCAT('CONC-', LPAD(np.category_num::text, 4, '0'))
    ELSE CONCAT('PRD-', LPAD(np.global_num::text, 4, '0'))
  END
FROM numbered_products np
WHERE p.id = np.id;

-- Phase 5: Add constraint to prevent NULL SKUs in the future
ALTER TABLE products
ADD CONSTRAINT products_sku_not_null 
CHECK (sku IS NOT NULL AND sku != '');

-- Add comment for documentation
COMMENT ON CONSTRAINT products_sku_not_null ON products IS 
'Ensures all products have a valid SKU - prevents label generation failures';
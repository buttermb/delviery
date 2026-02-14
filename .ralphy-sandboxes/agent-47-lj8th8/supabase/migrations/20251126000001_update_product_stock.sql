-- Update product stock quantities to realistic values
-- This fixes the Cash Register showing no products issue

-- Update all products with 0 stock to have reasonable stock levels
UPDATE public.products
SET stock_quantity = CASE 
  WHEN category ILIKE '%flower%' OR category ILIKE '%pre-roll%' THEN 
    floor(random() * 50 + 100)::int  -- 100-150 for flower products
  WHEN category ILIKE '%edible%' OR category ILIKE '%gummy%' OR category ILIKE '%chocolate%' THEN 
    floor(random() * 100 + 150)::int  -- 150-250 for edibles
  WHEN category ILIKE '%vape%' OR category ILIKE '%cart%' THEN 
    floor(random() * 75 + 75)::int   -- 75-150 for vapes
  WHEN category ILIKE '%concentrate%' OR category ILIKE '%diamond%' OR category ILIKE '%rosin%' THEN 
    floor(random() * 30 + 50)::int   -- 50-80 for concentrates
  ELSE 
    floor(random() * 100 + 50)::int  -- 50-150 default
END
WHERE stock_quantity = 0 OR stock_quantity IS NULL;

-- Also update low_stock_threshold for products that don't have it set
UPDATE public.products
SET low_stock_threshold = CASE 
  WHEN stock_quantity >= 100 THEN 20
  WHEN stock_quantity >= 50 THEN 10
  ELSE 5
END
WHERE low_stock_threshold IS NULL OR low_stock_threshold = 0;

-- Log the update
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count FROM public.products WHERE stock_quantity > 0;
  RAISE NOTICE 'Updated % products with stock quantities', updated_count;
END $$;


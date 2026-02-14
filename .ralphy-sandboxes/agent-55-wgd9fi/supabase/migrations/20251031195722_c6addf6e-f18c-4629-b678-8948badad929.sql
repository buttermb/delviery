-- Add pricing support to wholesale_inventory
ALTER TABLE wholesale_inventory 
ADD COLUMN IF NOT EXISTS prices JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS base_price NUMERIC(10,2);

-- Add prices column to disposable_menu_products for custom pricing
ALTER TABLE disposable_menu_products
ADD COLUMN IF NOT EXISTS prices JSONB;

-- Populate sample realistic cannabis pricing
UPDATE wholesale_inventory 
SET prices = jsonb_build_object(
  '3.5g', CASE 
    WHEN category = 'Flower' THEN 35.00
    WHEN category = 'Concentrates' THEN 45.00
    WHEN category = 'Edibles' THEN 25.00
    WHEN category = 'Pre-Rolls' THEN 15.00
    ELSE 30.00
  END,
  '7g', CASE 
    WHEN category = 'Flower' THEN 65.00
    WHEN category = 'Concentrates' THEN 85.00
    WHEN category = 'Edibles' THEN 45.00
    WHEN category = 'Pre-Rolls' THEN 28.00
    ELSE 55.00
  END,
  '14g', CASE 
    WHEN category = 'Flower' THEN 120.00
    WHEN category = 'Concentrates' THEN 160.00
    WHEN category = 'Edibles' THEN 80.00
    WHEN category = 'Pre-Rolls' THEN 50.00
    ELSE 100.00
  END,
  '28g', CASE 
    WHEN category = 'Flower' THEN 220.00
    WHEN category = 'Concentrates' THEN 300.00
    WHEN category = 'Edibles' THEN 150.00
    WHEN category = 'Pre-Rolls' THEN 90.00
    ELSE 180.00
  END
),
base_price = CASE 
  WHEN category = 'Flower' THEN 35.00
  WHEN category = 'Concentrates' THEN 45.00
  WHEN category = 'Edibles' THEN 25.00
  WHEN category = 'Pre-Rolls' THEN 15.00
  ELSE 30.00
END
WHERE prices IS NULL OR prices = '{}'::jsonb;

COMMENT ON COLUMN wholesale_inventory.prices IS 'JSONB object storing weight-based prices (e.g., {"3.5g": 35.00, "7g": 65.00})';
COMMENT ON COLUMN wholesale_inventory.base_price IS 'Base price for simple pricing model or fallback';
COMMENT ON COLUMN disposable_menu_products.prices IS 'Custom prices for this menu (overrides inventory prices)';
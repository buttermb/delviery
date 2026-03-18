
-- Add menu_visibility column to products table
-- This column is used by triggers to track whether products should appear in menus

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS menu_visibility BOOLEAN DEFAULT true NOT NULL;

-- Update existing products: set menu_visibility based on current stock
UPDATE public.products 
SET menu_visibility = (available_quantity > 0)
WHERE menu_visibility IS NULL OR menu_visibility != (available_quantity > 0);

-- Add index for better query performance when filtering by menu visibility
CREATE INDEX IF NOT EXISTS idx_products_menu_visibility 
ON public.products(menu_visibility) 
WHERE menu_visibility = true;

-- Add comment
COMMENT ON COLUMN public.products.menu_visibility IS 'Tracks whether product should be visible in disposable menus. Automatically managed by triggers based on available_quantity.';

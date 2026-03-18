-- Add weight and dimension fields to products table
-- Used for shipping cost calculation and delivery route optimization

-- Add dimension columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS weight_kg numeric(10, 3) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS length_cm numeric(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS width_cm numeric(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS height_cm numeric(10, 2) DEFAULT NULL;

-- Add comment to document purpose
COMMENT ON COLUMN public.products.weight_kg IS 'Shipping weight in kilograms';
COMMENT ON COLUMN public.products.length_cm IS 'Package length in centimeters';
COMMENT ON COLUMN public.products.width_cm IS 'Package width in centimeters';
COMMENT ON COLUMN public.products.height_cm IS 'Package height in centimeters';

-- Create index for products with dimensions (useful for route optimization queries)
CREATE INDEX IF NOT EXISTS idx_products_has_dimensions
ON public.products (tenant_id)
WHERE weight_kg IS NOT NULL OR (length_cm IS NOT NULL AND width_cm IS NOT NULL AND height_cm IS NOT NULL);

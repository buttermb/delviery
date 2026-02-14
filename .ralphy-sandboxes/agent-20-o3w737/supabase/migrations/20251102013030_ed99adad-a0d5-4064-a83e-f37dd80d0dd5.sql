-- Add missing columns to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_per_lb NUMERIC DEFAULT 0;

-- Add missing items column to menu_orders table  
ALTER TABLE public.menu_orders
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
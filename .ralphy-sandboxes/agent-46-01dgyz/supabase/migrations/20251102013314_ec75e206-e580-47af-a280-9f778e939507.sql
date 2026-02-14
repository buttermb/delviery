-- Add warehouse_location column to inventory_batches
ALTER TABLE public.inventory_batches
  ADD COLUMN IF NOT EXISTS warehouse_location TEXT DEFAULT 'Main Warehouse';

-- Rename expiry_date to expiration_date to match frontend expectations
ALTER TABLE public.inventory_batches
  RENAME COLUMN expiry_date TO expiration_date;
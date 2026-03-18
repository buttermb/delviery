-- Phase 5: Part 1 - Column additions and simple tables

-- 5.1 Reserved Stock System
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER DEFAULT 0;

-- 5.2 Price Snapshots
ALTER TABLE public.unified_order_items ADD COLUMN IF NOT EXISTS price_at_order_time NUMERIC;

-- 5.3 Orphaned Order Detection
ALTER TABLE public.unified_orders ADD COLUMN IF NOT EXISTS orphaned_at TIMESTAMPTZ;
ALTER TABLE public.wholesale_orders ADD COLUMN IF NOT EXISTS orphaned_at TIMESTAMPTZ;

-- Add tax exempt flags
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_tax_exempt BOOLEAN DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tax_exempt_certificate TEXT;
ALTER TABLE public.wholesale_clients ADD COLUMN IF NOT EXISTS is_tax_exempt BOOLEAN DEFAULT false;
ALTER TABLE public.wholesale_clients ADD COLUMN IF NOT EXISTS tax_exempt_certificate TEXT;
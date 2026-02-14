-- ============================================================
-- PHASE 1: Portal Architecture Database Migration
-- Adds portal tokens, client linking, and conversion tracking
-- ============================================================

-- 1. Add portal_token to wholesale_clients (UNIQUE for security)
ALTER TABLE wholesale_clients 
ADD COLUMN IF NOT EXISTS portal_token uuid UNIQUE DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_clients_portal_token 
ON wholesale_clients(portal_token);

-- Backfill existing clients
UPDATE wholesale_clients 
SET portal_token = gen_random_uuid() 
WHERE portal_token IS NULL;

-- 2. CRITICAL: Add client_id to invoices table (was missing!)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS client_id uuid 
REFERENCES wholesale_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_client_id 
ON invoices(client_id);

-- 3. Add client_id to menu_orders (direct link - recommended)
ALTER TABLE menu_orders
ADD COLUMN IF NOT EXISTS client_id uuid 
REFERENCES wholesale_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_menu_orders_client_id 
ON menu_orders(client_id);

-- 4. Backfill menu_orders.client_id from existing whitelist relationship
UPDATE menu_orders mo
SET client_id = maw.customer_id
FROM menu_access_whitelist maw
WHERE mo.access_whitelist_id = maw.id 
  AND maw.customer_id IS NOT NULL
  AND mo.client_id IS NULL;

-- 5. Backfill invoices.client_id from related converted orders
UPDATE invoices i
SET client_id = (
  SELECT DISTINCT client_id 
  FROM menu_orders mo 
  WHERE mo.converted_to_invoice_id = i.id 
    AND mo.client_id IS NOT NULL
  LIMIT 1
)
WHERE i.client_id IS NULL;

-- 6. Add conversion tracking to prevent double conversion
ALTER TABLE menu_orders
ADD COLUMN IF NOT EXISTS converted_to_invoice_id uuid 
REFERENCES invoices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS converted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_menu_orders_invoice 
ON menu_orders(converted_to_invoice_id);

-- 7. Optional: Add portal token expiry for time-limited access (commented out)
-- Uncomment if you want time-limited portal links:
-- ALTER TABLE wholesale_clients
-- ADD COLUMN IF NOT EXISTS portal_token_expires_at timestamptz;

-- Verify all columns created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wholesale_clients' AND column_name = 'portal_token'
  ) THEN
    RAISE EXCEPTION 'portal_token column not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'client_id'
  ) THEN
    RAISE EXCEPTION 'client_id column not created in invoices table';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_orders' AND column_name = 'client_id'
  ) THEN
    RAISE EXCEPTION 'client_id column not created in menu_orders table';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_orders' AND column_name = 'converted_to_invoice_id'
  ) THEN
    RAISE EXCEPTION 'converted_to_invoice_id column not created';
  END IF;
END $$;


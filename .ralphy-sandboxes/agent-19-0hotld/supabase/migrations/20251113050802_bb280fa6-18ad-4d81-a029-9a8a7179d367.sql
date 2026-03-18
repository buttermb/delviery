-- Phase 2: Fix Database Schema Inconsistencies
-- Add business_name column to disposable_menus if it doesn't exist
ALTER TABLE disposable_menus 
ADD COLUMN IF NOT EXISTS business_name TEXT;

-- Add comment for clarity
COMMENT ON COLUMN disposable_menus.business_name IS 'Business name displayed in order notifications and customer-facing communications';

-- Ensure proper indexes exist for menu queries
CREATE INDEX IF NOT EXISTS idx_disposable_menus_tenant_status 
ON disposable_menus(tenant_id, status) 
WHERE status = 'active';

-- Ensure menu_orders has proper foreign key behavior
ALTER TABLE menu_orders 
DROP CONSTRAINT IF EXISTS menu_orders_menu_id_fkey;

ALTER TABLE menu_orders
ADD CONSTRAINT menu_orders_menu_id_fkey 
FOREIGN KEY (menu_id) 
REFERENCES disposable_menus(id) 
ON DELETE CASCADE;
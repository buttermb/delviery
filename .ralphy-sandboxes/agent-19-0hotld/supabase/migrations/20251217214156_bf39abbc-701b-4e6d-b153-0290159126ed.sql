-- Add version columns for optimistic locking
ALTER TABLE products ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE wholesale_orders ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE unified_orders ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE wholesale_clients ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Add reserved_quantity to location_inventory if not exists
ALTER TABLE location_inventory ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER DEFAULT 0;

-- Add constraint to prevent negative reserved quantities
ALTER TABLE location_inventory DROP CONSTRAINT IF EXISTS location_inventory_reserved_non_negative;
ALTER TABLE location_inventory ADD CONSTRAINT location_inventory_reserved_non_negative CHECK (reserved_quantity >= 0);

-- Create index for faster orphaned order detection
CREATE INDEX IF NOT EXISTS idx_unified_orders_orphaned ON unified_orders(status, orphaned_at, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_orphaned ON wholesale_orders(status, orphaned_at, created_at) WHERE status = 'pending';
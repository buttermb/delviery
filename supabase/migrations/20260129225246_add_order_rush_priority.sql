-- Add rush order priority functionality
-- Allows orders to be marked as "rush" to expedite them to the front of the queue

-- Add is_rush column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_rush boolean DEFAULT false;

-- Add rushed_at timestamp to track when an order was marked as rush
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rushed_at timestamptz;

-- Add rushed_by to track who marked the order as rush
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rushed_by uuid REFERENCES auth.users(id);

-- Create index for efficient querying of rush orders
CREATE INDEX IF NOT EXISTS idx_orders_is_rush ON orders(is_rush) WHERE is_rush = true;

-- Create composite index for tenant + rush + created_at for queue ordering
CREATE INDEX IF NOT EXISTS idx_orders_tenant_rush_created
  ON orders(tenant_id, is_rush DESC, created_at ASC);

-- Add comment explaining the purpose
COMMENT ON COLUMN orders.is_rush IS 'When true, order is prioritized to the front of the processing queue';
COMMENT ON COLUMN orders.rushed_at IS 'Timestamp when the order was marked as rush';
COMMENT ON COLUMN orders.rushed_by IS 'User ID who marked the order as rush';

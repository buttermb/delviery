-- Add missing status values to menu_order_status enum
ALTER TYPE menu_order_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE menu_order_status ADD VALUE IF NOT EXISTS 'preparing';
ALTER TYPE menu_order_status ADD VALUE IF NOT EXISTS 'ready_for_pickup';
ALTER TYPE menu_order_status ADD VALUE IF NOT EXISTS 'in_transit';
ALTER TYPE menu_order_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE menu_order_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE menu_order_status ADD VALUE IF NOT EXISTS 'delivered';
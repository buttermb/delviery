-- Migration: Storefront order status lifecycle
-- Relaxes the marketplace_orders status CHECK constraint to include all storefront statuses
-- and adds timestamp columns for each status transition.

-- 1. Drop old CHECK constraint on status (named or inline)
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Find the CHECK constraint on marketplace_orders.status
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE rel.relname = 'marketplace_orders'
    AND nsp.nspname = 'public'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%status%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.marketplace_orders DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

-- 2. Add new CHECK constraint with all valid statuses (marketplace + storefront)
ALTER TABLE public.marketplace_orders
  ADD CONSTRAINT marketplace_orders_status_check
  CHECK (status IN (
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'out_for_delivery',
    'delivered',
    'completed',
    'cancelled',
    -- Legacy marketplace statuses kept for backward compatibility
    'accepted',
    'processing',
    'shipped',
    'rejected',
    'refunded'
  ));

-- 3. Add timestamp columns for storefront status transitions
ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS out_for_delivery_at TIMESTAMPTZ;

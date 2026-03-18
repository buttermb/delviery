-- Add source traceability columns to orders table
-- Links orders back to their origin menu or storefront session

-- Add source_menu_id for orders from disposable menus
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS source_menu_id uuid REFERENCES public.disposable_menus(id) ON DELETE SET NULL;

-- Add source_session_id for orders from storefront with session tracking
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS source_session_id uuid;

-- Index for efficient lookups by source menu
CREATE INDEX IF NOT EXISTS idx_orders_source_menu_id
ON public.orders(tenant_id, source_menu_id)
WHERE source_menu_id IS NOT NULL;

-- Index for session-based lookups
CREATE INDEX IF NOT EXISTS idx_orders_source_session_id
ON public.orders(tenant_id, source_session_id)
WHERE source_session_id IS NOT NULL;

-- Add same columns to unified_orders if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unified_orders') THEN
    ALTER TABLE public.unified_orders
    ADD COLUMN IF NOT EXISTS source_menu_id uuid;

    ALTER TABLE public.unified_orders
    ADD COLUMN IF NOT EXISTS source_session_id uuid;

    CREATE INDEX IF NOT EXISTS idx_unified_orders_source_menu_id
    ON public.unified_orders(tenant_id, source_menu_id)
    WHERE source_menu_id IS NOT NULL;
  END IF;
END $$;

-- Comments for documentation
COMMENT ON COLUMN public.orders.source_menu_id IS 'Reference to disposable_menus when order originated from a menu';
COMMENT ON COLUMN public.orders.source_session_id IS 'Session ID for orders from storefront for journey tracking';

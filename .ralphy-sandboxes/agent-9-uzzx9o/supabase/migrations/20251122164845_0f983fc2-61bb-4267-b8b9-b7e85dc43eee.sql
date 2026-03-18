-- Drop old conflicting triggers to prevent duplicate order syncing
DROP TRIGGER IF EXISTS trigger_sync_menu_order_to_main ON public.menu_orders;
DROP TRIGGER IF EXISTS trigger_sync_menu_order_status ON public.menu_orders;
DROP TRIGGER IF EXISTS trigger_update_inventory_from_menu_order ON public.menu_orders;

-- Drop old trigger functions if they exist
DROP FUNCTION IF EXISTS public.sync_menu_order_to_main CASCADE;
DROP FUNCTION IF EXISTS public.sync_menu_order_status CASCADE;
DROP FUNCTION IF EXISTS public.update_inventory_from_menu_order CASCADE;
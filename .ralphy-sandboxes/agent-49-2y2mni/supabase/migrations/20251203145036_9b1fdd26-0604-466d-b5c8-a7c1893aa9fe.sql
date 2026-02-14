-- Create sync triggers for unified orders (triggers only, no backfill)
DROP TRIGGER IF EXISTS menu_order_sync_trigger ON public.menu_orders;
DROP TRIGGER IF EXISTS wholesale_order_sync_trigger ON public.wholesale_orders;
DROP TRIGGER IF EXISTS pos_transaction_sync_trigger ON public.pos_transactions;

CREATE TRIGGER menu_order_sync_trigger
AFTER INSERT OR UPDATE ON public.menu_orders
FOR EACH ROW EXECUTE FUNCTION public.sync_menu_order_to_unified();

CREATE TRIGGER wholesale_order_sync_trigger
AFTER INSERT OR UPDATE ON public.wholesale_orders
FOR EACH ROW EXECUTE FUNCTION public.sync_wholesale_order_to_unified();

CREATE TRIGGER pos_transaction_sync_trigger
AFTER INSERT OR UPDATE ON public.pos_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_pos_transaction_to_unified();
-- Update wholesale_orders status constraint to include 'processing' and 'ready' statuses for the Pipeline board
ALTER TABLE public.wholesale_orders DROP CONSTRAINT IF EXISTS wholesale_orders_status_check;

ALTER TABLE public.wholesale_orders ADD CONSTRAINT wholesale_orders_status_check 
CHECK (status = ANY (ARRAY['pending', 'assigned', 'processing', 'ready', 'in_transit', 'delivered', 'cancelled']));
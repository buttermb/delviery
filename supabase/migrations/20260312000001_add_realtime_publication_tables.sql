-- Add missing tables to the Supabase realtime publication
-- so that useRealtimeSync can receive change notifications for CRM,
-- wholesale, delivery zone, POS transaction, and menu order item tables.

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'crm_clients',
    'crm_invoices',
    'crm_pre_orders',
    'crm_notes',
    'wholesale_clients',
    'wholesale_payments',
    'delivery_zones',
    'pos_transactions',
    'menu_order_items'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    -- Only add if the table exists and is not already in the publication
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      RAISE NOTICE 'Added % to supabase_realtime publication', tbl;
    END IF;
  END LOOP;
END $$;

-- Enable realtime for credit tables so useCredits hook receives
-- instant balance updates via Supabase Realtime subscriptions.
--
-- Without this, the postgres_changes listeners in useCredits are
-- silently ignored because the tables are not in the publication.

DO $$
BEGIN
  -- tenant_credits: balance changes trigger instant UI refresh
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenant_credits'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tenant_credits'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_credits;
    RAISE NOTICE 'Added tenant_credits to supabase_realtime publication';
  END IF;

  -- credit_transactions: new transactions trigger balance refetch
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'credit_transactions'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'credit_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_transactions;
    RAISE NOTICE 'Added credit_transactions to supabase_realtime publication';
  END IF;
END $$;

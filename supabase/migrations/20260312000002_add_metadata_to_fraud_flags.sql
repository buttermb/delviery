DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fraud_flags' AND table_schema = 'public') THEN
    ALTER TABLE fraud_flags ADD COLUMN IF NOT EXISTS metadata jsonb;
  END IF;
END $$;

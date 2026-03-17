-- Add currency columns to crm_invoices if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_invoices' AND table_schema = 'public') THEN
    ALTER TABLE crm_invoices ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';
    ALTER TABLE crm_invoices ADD COLUMN IF NOT EXISTS exchange_rate numeric(12,6);
    ALTER TABLE crm_invoices ADD COLUMN IF NOT EXISTS original_currency_total numeric(12,2);
  ELSE
    RAISE NOTICE 'crm_invoices table does not exist, skipping';
  END IF;
END $$;

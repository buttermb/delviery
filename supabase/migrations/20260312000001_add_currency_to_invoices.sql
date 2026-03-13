ALTER TABLE crm_invoices ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';
ALTER TABLE crm_invoices ADD COLUMN IF NOT EXISTS exchange_rate numeric(12,6);
ALTER TABLE crm_invoices ADD COLUMN IF NOT EXISTS original_currency_total numeric(12,2);

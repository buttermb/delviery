-- Add missing transaction_date column to supplier_transactions
ALTER TABLE public.supplier_transactions
  ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMPTZ DEFAULT NOW();

-- Add tenant_id to accounts table for multi-tenancy
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Create index
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_date ON public.supplier_transactions(transaction_date DESC);
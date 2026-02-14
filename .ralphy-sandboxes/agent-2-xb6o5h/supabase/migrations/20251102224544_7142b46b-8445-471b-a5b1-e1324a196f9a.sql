-- Add missing columns for tenant signup data
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS company_size TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.tenants.industry IS 'Industry/business type (e.g., retail, wholesale, delivery)';
COMMENT ON COLUMN public.tenants.company_size IS 'Company size category (e.g., 1-10, 11-50, 51-200, 200+)';
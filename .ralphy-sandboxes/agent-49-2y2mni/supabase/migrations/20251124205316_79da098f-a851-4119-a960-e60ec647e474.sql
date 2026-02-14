-- Add onboarding_skipped column to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS onboarding_skipped BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.tenants.onboarding_skipped IS 'Tracks if user skipped onboarding wizard';
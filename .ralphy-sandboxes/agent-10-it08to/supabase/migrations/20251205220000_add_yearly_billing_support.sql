-- Add yearly billing support to subscription_plans
-- This migration adds columns for yearly Stripe prices and yearly pricing

-- Add stripe_price_id_yearly column for yearly Stripe prices
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS stripe_price_id_yearly TEXT;

-- Add price_yearly column if missing
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS price_yearly NUMERIC(10,2);

-- Add billing_cycle column to tenants to track their billing preference
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly' 
CHECK (billing_cycle IN ('monthly', 'yearly'));

-- Update yearly prices (17% discount = ~2 months free)
UPDATE public.subscription_plans SET price_yearly = 790 WHERE LOWER(name) = 'starter';
UPDATE public.subscription_plans SET price_yearly = 1500 WHERE LOWER(name) = 'professional';
UPDATE public.subscription_plans SET price_yearly = 4990 WHERE LOWER(name) = 'enterprise';

-- Add comments for documentation
COMMENT ON COLUMN public.subscription_plans.stripe_price_id_yearly IS 'Stripe Price ID for yearly billing (e.g., price_xxx)';
COMMENT ON COLUMN public.subscription_plans.price_yearly IS 'Yearly price in dollars (17% discount from monthly * 12)';
COMMENT ON COLUMN public.tenants.billing_cycle IS 'Billing cycle preference: monthly or yearly';

-- Create index for billing cycle queries
CREATE INDEX IF NOT EXISTS idx_tenants_billing_cycle ON public.tenants(billing_cycle);

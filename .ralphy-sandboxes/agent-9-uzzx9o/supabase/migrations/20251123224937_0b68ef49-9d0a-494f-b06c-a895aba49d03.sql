-- Add stripe_price_id column to subscription_plans table
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN public.subscription_plans.stripe_price_id IS 'Stripe Price ID (e.g., price_xxx) for recurring subscription billing';
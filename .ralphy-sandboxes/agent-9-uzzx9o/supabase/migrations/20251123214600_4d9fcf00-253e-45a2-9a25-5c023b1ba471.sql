-- Fix 1: Add missing is_active column to subscription_plans
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;

-- Update existing records to be active  
UPDATE public.subscription_plans SET is_active = true;

-- Add index for active plans queries
CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active ON public.subscription_plans(is_active);
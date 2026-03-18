-- Add account_id and role columns to profiles table for multi-tenant support

-- Add account_id column (nullable initially)
ALTER TABLE public.profiles 
ADD COLUMN account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Add role column with default value
ALTER TABLE public.profiles 
ADD COLUMN role TEXT DEFAULT 'customer';

-- Create index for faster account lookups
CREATE INDEX idx_profiles_account_id ON public.profiles(account_id);

-- Update existing admin user to be account owner of BuddasH NYC account
UPDATE public.profiles
SET 
  account_id = '86a0f609-ccf9-44ab-b0ed-06c5e9005340',
  role = 'account_owner'
WHERE user_id = '7f488177-dcf9-4eeb-91e6-c6353fcf32c1';
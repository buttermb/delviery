-- Add user_id column to wholesale_runners for authentication
ALTER TABLE public.wholesale_runners 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS admin_pin TEXT;

-- Create unique index on user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_wholesale_runners_user_id ON public.wholesale_runners(user_id);

-- Update RLS policies for runners
DROP POLICY IF EXISTS "Runners can view own data" ON public.wholesale_runners;
CREATE POLICY "Runners can view own data"
ON public.wholesale_runners
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Runners can update own location" ON public.wholesale_runners;
CREATE POLICY "Runners can update own location"
ON public.wholesale_runners
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
-- Add column to store the plain access code for admin reference
ALTER TABLE public.disposable_menus 
ADD COLUMN IF NOT EXISTS access_code TEXT;
-- Add operating_settings jsonb column to tenants table
ALTER TABLE IF EXISTS public.tenants 
ADD COLUMN IF NOT EXISTS operating_settings JSONB DEFAULT '{}'::jsonb;

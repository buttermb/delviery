-- Add missing columns to tenant_invitations
ALTER TABLE public.tenant_invitations 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id);
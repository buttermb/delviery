-- Add default value for token column so inserts don't fail
ALTER TABLE public.tenant_invitations
ALTER COLUMN token SET DEFAULT encode(gen_random_bytes(32), 'hex');

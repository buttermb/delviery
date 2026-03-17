-- Add default value for token column so inserts don't fail
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE public.tenant_invitations
ALTER COLUMN token SET DEFAULT encode(extensions.gen_random_bytes(32), 'hex');

-- Migration: 20251212000005_move_extensions.sql
-- Description: Move all extensions to the 'extensions' schema to keep public schema clean

-- 1. Create extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- 2. Move extensions
-- Note: 'ALTER EXTENSION ... SET SCHEMA' is the way to move them.
-- We use DO blocks to avoid errors if extensions don't exist.

DO $$
BEGIN
  -- pgcrypto
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    ALTER EXTENSION pgcrypto SET SCHEMA extensions;
  END IF;

  -- pg_net
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    ALTER EXTENSION pg_net SET SCHEMA extensions;
  END IF;

  -- pg_cron
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    ALTER EXTENSION pg_cron SET SCHEMA extensions;
  END IF;

  -- uuid-ossp (if used)
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
    ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;
  END IF;

   -- vector (for AI embeddings, if used)
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    ALTER EXTENSION vector SET SCHEMA extensions;
  END IF;
END $$;

-- 3. Grant usage on extensions schema to authenticated users
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated, anon, service_role;

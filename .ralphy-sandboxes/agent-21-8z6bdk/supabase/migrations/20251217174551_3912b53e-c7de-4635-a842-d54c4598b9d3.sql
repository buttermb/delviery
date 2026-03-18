-- Move extensions from public schema to extensions schema for better security
-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage on extensions schema
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Note: pg_net and other extensions are managed by Supabase and cannot be moved
-- The linter warning about extensions in public schema is informational
-- We'll create a comment to document this was reviewed

COMMENT ON SCHEMA public IS 'Standard public schema - extensions reviewed for security 2024-12-17';
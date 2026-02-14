-- ============================================================================
-- SECURITY FIX: Remove role column from profiles table
-- 
-- CRITICAL VULNERABILITY: Storing roles in profiles table allows privilege
-- escalation attacks. Roles MUST be stored in separate user_roles table.
--
-- This migration:
-- 1. Removes the dangerous role column from profiles table
-- 2. Ensures all role checks use the secure user_roles table
-- ============================================================================

-- Remove role column from profiles table (privilege escalation risk)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- Verify user_roles table exists with proper structure
-- (It should already exist from previous migrations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_roles'
  ) THEN
    RAISE EXCEPTION 'user_roles table does not exist! Roles must be managed in user_roles table, not profiles.';
  END IF;
END $$;

-- Ensure has_role function exists and is properly secured
-- (It should already exist from migration 20251031233127)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'has_role'
  ) THEN
    RAISE EXCEPTION 'has_role() function does not exist! This function is required for secure role checking.';
  END IF;
END $$;
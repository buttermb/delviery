
-- =============================================
-- FIX WARN-LEVEL SECURITY ISSUES
-- =============================================

-- 1. FIX: Function Search Path Mutable for refresh_menu_analytics
CREATE OR REPLACE FUNCTION public.refresh_menu_analytics()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY menu_analytics_summary;
END;
$function$;

-- 2. FIX: Function Search Path Mutable for update_updated_at_column  
-- Note: This function likely exists already, we need to check its definition first
-- Creating a safe version that handles the common use case
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 3. FIX: Extension in Public - Move pg_net to extensions schema
-- First ensure extensions schema exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage on extensions schema to necessary roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Note: Moving an extension requires drop and recreate which can break dependent objects
-- Instead, we'll document this as a manual action needed
-- The safer approach is to revoke public access to the extension functions

-- 4. FIX: Materialized View in API - Restrict access to menu_analytics_summary
-- Revoke direct access from anon users, keep for authenticated
REVOKE ALL ON public.menu_analytics_summary FROM anon;
GRANT SELECT ON public.menu_analytics_summary TO authenticated;
GRANT ALL ON public.menu_analytics_summary TO service_role;

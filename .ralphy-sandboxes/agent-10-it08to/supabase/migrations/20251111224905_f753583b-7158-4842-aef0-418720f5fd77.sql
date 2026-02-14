-- PHASE 7: Fix remaining search_path issues and security definer view

-- Fix all remaining functions without search_path
-- These are likely functions created after the initial migration

-- Note: The linter also found a Security Definer View which should be reviewed manually
-- Views with SECURITY DEFINER enforce creator's permissions rather than querying user's permissions
-- This is typically used intentionally but should be documented

-- Add search_path to any remaining functions that don't have it
-- We'll use a comprehensive approach to catch any that were missed

ALTER FUNCTION public.generate_wholesale_order_number() SET search_path = public;
ALTER FUNCTION public.set_wholesale_order_number() SET search_path = public;
ALTER FUNCTION public.set_shift_number() SET search_path = public;
ALTER FUNCTION public.activate_whitelist_on_first_access() SET search_path = public;
ALTER FUNCTION public.update_client_reliability(uuid, boolean) SET search_path = public;
ALTER FUNCTION public.sync_delivery_schedule_columns() SET search_path = public;
ALTER FUNCTION public.generate_pos_transaction_number() SET search_path = public;
ALTER FUNCTION public.generate_shift_number() SET search_path = public;
ALTER FUNCTION public.set_pos_transaction_number() SET search_path = public;
ALTER FUNCTION public.update_menu_view_tracking() SET search_path = public;
ALTER FUNCTION public.update_shift_totals() SET search_path = public;
ALTER FUNCTION public.handle_pos_refund() SET search_path = public;
ALTER FUNCTION public.update_user_risk_score() SET search_path = public;
ALTER FUNCTION public.generate_entry_number() SET search_path = public;
ALTER FUNCTION public.auto_assign_order_tenant() SET search_path = public;
ALTER FUNCTION public.check_inventory_levels() SET search_path = public;
ALTER FUNCTION public.trigger_workflow_on_database_event() SET search_path = public;
ALTER FUNCTION public.create_workflow_version() SET search_path = public;
ALTER FUNCTION public.increment_runner_deliveries(uuid) SET search_path = public;
ALTER FUNCTION public.auto_assign_tenant_id() SET search_path = public;
ALTER FUNCTION public.update_last_access_timestamp() SET search_path = public;

-- Add comment documenting the security considerations
COMMENT ON FUNCTION public.has_role(uuid, app_role) IS 
  'SECURITY DEFINER function to check user roles. Bypasses RLS to prevent recursive policy checks. This is intentional and required for the role-based permission system.';

-- Document remaining linter warnings for manual review:
-- 1. SECURITY DEFINER VIEW: Review any views with SECURITY DEFINER to ensure they are intentional
-- 2. EXTENSION IN PUBLIC: Extensions installed in public schema (typically acceptable for user extensions)
-- 3. LEAKED PASSWORD PROTECTION: Enable in auth settings for production (Supabase auth configuration)
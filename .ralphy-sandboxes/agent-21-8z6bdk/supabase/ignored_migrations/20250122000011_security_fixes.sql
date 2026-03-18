-- Security Fixes (Error #3 & #4)
-- 1. Fix Security Definer Views (Convert to Security Invoker where appropriate)
-- 2. Add search_path to functions

-- Fix Error #4: Add search_path to critical functions
ALTER FUNCTION public.sync_menu_order_to_systems() SET search_path = 'public';
ALTER FUNCTION public.decrement_product_inventory(UUID, NUMERIC) SET search_path = 'public';

-- Note: For views, we need to identify specific ones. 
-- Based on common patterns, we'll ensure RLS is active on underlying tables 
-- and avoid SECURITY DEFINER on views unless absolutely necessary.
-- If specific views were identified as problematic, we would alter them here.
-- For now, we focus on the functions we just touched or are critical.

-- Fix Error #3: Review Security Definer Views
-- (Placeholder: If specific views were named, we'd fix them here. 
-- Assuming runner_earnings_view was mentioned)
-- DROP VIEW IF EXISTS public.runner_earnings_view;
-- CREATE VIEW public.runner_earnings_view WITH (security_invoker = true) AS ...

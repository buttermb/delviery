-- Security Hardening (Error #41-45)

-- 1. Fix Security Definer Views (Convert to Security Invoker)
-- These views were identified as potential security risks.
-- We recreate them with security_invoker = true to respect RLS.

-- runner_earnings_view
DROP VIEW IF EXISTS public.runner_earnings_view;
CREATE OR REPLACE VIEW public.runner_earnings_view WITH (security_invoker = true) AS
SELECT
    r.id AS runner_id,
    r.first_name,
    r.last_name,
    COUNT(d.id) AS total_deliveries,
    COALESCE(SUM(d.delivery_fee), 0) AS total_earnings
FROM public.courier_profiles r
LEFT JOIN public.deliveries d ON r.id = d.courier_id AND d.status = 'completed'
GROUP BY r.id;

-- public_order_tracking
DROP VIEW IF EXISTS public.public_order_tracking;
CREATE OR REPLACE VIEW public.public_order_tracking WITH (security_invoker = true) AS
SELECT
    o.id,
    o.status,
    o.estimated_delivery_time,
    o.courier_id
FROM public.orders o;

-- 2. Fix Functions Missing search_path
-- Add search_path = 'public' to prevent search path hijacking

ALTER FUNCTION public.restore_order_inventory() SET search_path = 'public';
ALTER FUNCTION public.restore_wholesale_order_inventory() SET search_path = 'public';
ALTER FUNCTION public.calculate_customer_risk_score(UUID) SET search_path = 'public';
ALTER FUNCTION public.update_customer_risk_score_trigger() SET search_path = 'public';
ALTER FUNCTION public.log_audit_trail() SET search_path = 'public';
ALTER FUNCTION public.is_tenant_admin(UUID) SET search_path = 'public';

-- 3. Fix Materialized View Exposure (Error #47)
-- Revoke public access to materialized view if it exists
REVOKE ALL ON TABLE public.menu_analytics_summary FROM anon, authenticated;
-- Create a secure wrapper function or view if needed, but for now just lock it down.

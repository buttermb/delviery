-- Fix security definer views by recreating them as SECURITY INVOKER
DROP VIEW IF EXISTS wholesale_orders_unified;
DROP VIEW IF EXISTS menu_orders_unified;
DROP VIEW IF EXISTS pos_orders_unified;
DROP VIEW IF EXISTS retail_orders_unified;

-- Recreate views with SECURITY INVOKER (default, which respects RLS)
CREATE VIEW wholesale_orders_unified WITH (security_invoker = true) AS
SELECT * FROM unified_orders WHERE order_type = 'wholesale';

CREATE VIEW menu_orders_unified WITH (security_invoker = true) AS
SELECT * FROM unified_orders WHERE order_type = 'menu';

CREATE VIEW pos_orders_unified WITH (security_invoker = true) AS
SELECT * FROM unified_orders WHERE order_type = 'pos';

CREATE VIEW retail_orders_unified WITH (security_invoker = true) AS
SELECT * FROM unified_orders WHERE order_type = 'retail';
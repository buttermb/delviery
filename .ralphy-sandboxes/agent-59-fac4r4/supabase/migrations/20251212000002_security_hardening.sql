-- Security Hardening Migration
-- 1. Enforce RLS on critical tables (idempotent)
-- 2. Secure storefront_orders view with security_invoker
-- 3. Ensure extensions are in the correct schema

-- 1. Enable RLS on tables flagged by linter (if not already enabled)
ALTER TABLE IF EXISTS public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cart_item_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blog_posts ENABLE ROW LEVEL SECURITY;

-- 2. Recreate storefront_orders view with security_invoker = true
-- This ensures the view respects RLS policies of the underlying marketplace_orders table
DROP VIEW IF EXISTS public.storefront_orders;

CREATE OR REPLACE VIEW public.storefront_orders 
WITH (security_invoker = true) AS
SELECT 
  id,
  order_number,
  store_id,
  customer_id,
  COALESCE(customer_name, '') AS customer_name,
  COALESCE(customer_email, '') AS customer_email,
  COALESCE(customer_phone, '') AS customer_phone,
  status,
  payment_status,
  subtotal,
  COALESCE(tax_amount, 0) AS tax_amount,
  COALESCE(delivery_fee, 0) AS delivery_fee,
  total,
  delivery_address,
  delivery_notes,
  items,
  tracking_token,
  NULL::text AS stripe_session_id,
  NULL::text AS stripe_payment_intent_id,
  NULL::timestamptz AS paid_at,
  created_at,
  updated_at
FROM public.marketplace_orders
WHERE store_id IS NOT NULL;

-- 3. Ensure pgcrypto is in the extensions schema
-- This prevents pollution of the public schema
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

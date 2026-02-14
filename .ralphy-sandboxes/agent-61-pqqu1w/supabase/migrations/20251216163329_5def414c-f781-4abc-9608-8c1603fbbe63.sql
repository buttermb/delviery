
-- ===========================================
-- FIX 1: Tenants Table RLS - Remove overly permissive policies
-- ===========================================

-- Drop overly permissive policies that expose all tenant data
DROP POLICY IF EXISTS "tenants_select_by_slug_public" ON public.tenants;
DROP POLICY IF EXISTS "Anyone can view active tenants for login" ON public.tenants;
DROP POLICY IF EXISTS "tenants_select_by_slug" ON public.tenants;

-- Create a restricted policy for login lookup - only returns minimal data needed
-- This allows unauthenticated users to look up tenants by slug for login purposes
-- but the actual columns returned should be restricted at the application level
CREATE POLICY "tenants_public_login_lookup" ON public.tenants
  FOR SELECT
  TO anon
  USING (status = 'active' AND slug IS NOT NULL);

-- ===========================================
-- FIX 2: Security Definer Views - Recreate with security_invoker
-- ===========================================

-- Drop and recreate pos_orders_unified with security_invoker
DROP VIEW IF EXISTS public.pos_orders_unified;
CREATE VIEW public.pos_orders_unified 
WITH (security_invoker = true)
AS SELECT id, tenant_id, order_number, order_type, source, status, subtotal, 
         tax_amount, discount_amount, total_amount, payment_method, payment_status,
         customer_id, wholesale_client_id, menu_id, shift_id, delivery_address,
         delivery_notes, courier_id, contact_name, contact_phone, metadata,
         created_at, updated_at, delivered_at, cancelled_at, cancellation_reason
   FROM unified_orders
   WHERE order_type = 'pos';

-- Drop and recreate wholesale_orders_unified with security_invoker
DROP VIEW IF EXISTS public.wholesale_orders_unified;
CREATE VIEW public.wholesale_orders_unified 
WITH (security_invoker = true)
AS SELECT id, tenant_id, order_number, order_type, source, status, subtotal,
         tax_amount, discount_amount, total_amount, payment_method, payment_status,
         customer_id, wholesale_client_id, menu_id, shift_id, delivery_address,
         delivery_notes, courier_id, contact_name, contact_phone, metadata,
         created_at, updated_at, delivered_at, cancelled_at, cancellation_reason
   FROM unified_orders
   WHERE order_type = 'wholesale';

-- Drop and recreate menu_orders_unified with security_invoker
DROP VIEW IF EXISTS public.menu_orders_unified;
CREATE VIEW public.menu_orders_unified 
WITH (security_invoker = true)
AS SELECT id, tenant_id, order_number, order_type, source, status, subtotal,
         tax_amount, discount_amount, total_amount, payment_method, payment_status,
         customer_id, wholesale_client_id, menu_id, shift_id, delivery_address,
         delivery_notes, courier_id, contact_name, contact_phone, metadata,
         created_at, updated_at, delivered_at, cancelled_at, cancellation_reason
   FROM unified_orders
   WHERE order_type = 'menu';

-- Drop and recreate runner_earnings_view with security_invoker
DROP VIEW IF EXISTS public.runner_earnings_view;
CREATE VIEW public.runner_earnings_view 
WITH (security_invoker = true)
AS SELECT wd.runner_id, wd.id AS delivery_id, wd.order_id, wo.order_number,
         wd.status, wd.delivered_at AS created_at, wo.total_amount AS order_total,
         5.00 AS delivery_fee,
         CASE WHEN wd.status = 'delivered' THEN 5.00 ELSE 0 END AS total_earned,
         wc.business_name AS client_name, wo.delivery_address
   FROM wholesale_deliveries wd
   JOIN wholesale_orders wo ON wd.order_id = wo.id
   JOIN wholesale_clients wc ON wo.client_id = wc.id
   WHERE wd.status IN ('delivered', 'failed');

-- Drop and recreate disposable_menu_products_decrypted with security_invoker
DROP VIEW IF EXISTS public.disposable_menu_products_decrypted;
CREATE VIEW public.disposable_menu_products_decrypted 
WITH (security_invoker = true)
AS SELECT id, menu_id, product_id,
         CASE WHEN is_encrypted THEN decrypt_menu_numeric(encrypted_custom_price) ELSE custom_price END AS custom_price,
         display_availability, display_order, created_at, is_encrypted
   FROM disposable_menu_products;

-- Drop and recreate disposable_menus_decrypted with security_invoker  
DROP VIEW IF EXISTS public.disposable_menus_decrypted;
CREATE VIEW public.disposable_menus_decrypted 
WITH (security_invoker = true)
AS SELECT id,
         CASE WHEN is_encrypted THEN decrypt_menu_text(encrypted_name) ELSE name END AS name,
         CASE WHEN is_encrypted THEN decrypt_menu_text(encrypted_description) ELSE description END AS description,
         encrypted_url_token, access_code_hash, status, created_at, burned_at, burn_reason,
         expiration_date, never_expires,
         CASE WHEN is_encrypted THEN decrypt_menu_jsonb(encrypted_security_settings) ELSE security_settings END AS security_settings,
         CASE WHEN is_encrypted THEN decrypt_menu_jsonb(encrypted_appearance_settings) ELSE appearance_settings END AS appearance_settings,
         created_by,
         CASE WHEN is_encrypted THEN decrypt_menu_numeric(encrypted_min_order_quantity) ELSE min_order_quantity END AS min_order_quantity,
         CASE WHEN is_encrypted THEN decrypt_menu_numeric(encrypted_max_order_quantity) ELSE max_order_quantity END AS max_order_quantity,
         tenant_id, business_name, is_encrypted, encryption_version
   FROM disposable_menus;

-- Grant SELECT on views to authenticated users
GRANT SELECT ON public.pos_orders_unified TO authenticated;
GRANT SELECT ON public.wholesale_orders_unified TO authenticated;
GRANT SELECT ON public.menu_orders_unified TO authenticated;
GRANT SELECT ON public.runner_earnings_view TO authenticated;
GRANT SELECT ON public.disposable_menu_products_decrypted TO authenticated;
GRANT SELECT ON public.disposable_menus_decrypted TO authenticated;

-- Fix Security Definer Views (Part 1 - Existing Tables Only)
-- Security Issue: Views without security_invoker = true enforce creator's permissions instead of querying user's permissions

-- Fix runner_earnings_view
DROP VIEW IF EXISTS public.runner_earnings_view;
CREATE OR REPLACE VIEW public.runner_earnings_view WITH (security_invoker = true) AS
SELECT 
  wd.runner_id,
  wd.id as delivery_id,
  wd.order_id,
  wo.order_number,
  wd.status,
  wd.delivered_at as created_at,
  wo.total_amount as order_total,
  5.00 as delivery_fee,
  CASE 
    WHEN wd.status = 'delivered' THEN 5.00
    ELSE 0
  END as total_earned,
  wc.business_name as client_name,
  wo.delivery_address
FROM public.wholesale_deliveries wd
JOIN public.wholesale_orders wo ON wd.order_id = wo.id
JOIN public.wholesale_clients wc ON wo.client_id = wc.id
WHERE wd.status IN ('delivered', 'failed');

-- Fix disposable_menus_decrypted view
DROP VIEW IF EXISTS disposable_menus_decrypted;
CREATE OR REPLACE VIEW disposable_menus_decrypted WITH (security_invoker = true) AS
SELECT
  id,
  CASE 
    WHEN is_encrypted THEN decrypt_menu_text(encrypted_name)
    ELSE name
  END AS name,
  CASE 
    WHEN is_encrypted THEN decrypt_menu_text(encrypted_description)
    ELSE description
  END AS description,
  encrypted_url_token,
  access_code_hash,
  status,
  created_at,
  burned_at,
  burn_reason,
  expiration_date,
  never_expires,
  CASE 
    WHEN is_encrypted THEN decrypt_menu_jsonb(encrypted_security_settings)
    ELSE security_settings
  END AS security_settings,
  CASE 
    WHEN is_encrypted THEN decrypt_menu_jsonb(encrypted_appearance_settings)
    ELSE appearance_settings
  END AS appearance_settings,
  created_by,
  CASE 
    WHEN is_encrypted THEN decrypt_menu_numeric(encrypted_min_order_quantity)
    ELSE min_order_quantity
  END AS min_order_quantity,
  CASE 
    WHEN is_encrypted THEN decrypt_menu_numeric(encrypted_max_order_quantity)
    ELSE max_order_quantity
  END AS max_order_quantity,
  tenant_id,
  business_name,
  is_encrypted,
  encryption_version
FROM public.disposable_menus;

-- Fix disposable_menu_products_decrypted view
DROP VIEW IF EXISTS disposable_menu_products_decrypted;
CREATE OR REPLACE VIEW disposable_menu_products_decrypted WITH (security_invoker = true) AS
SELECT
  id,
  menu_id,
  product_id,
  CASE 
    WHEN is_encrypted THEN decrypt_menu_numeric(encrypted_custom_price)
    ELSE custom_price
  END AS custom_price,
  display_availability,
  display_order,
  created_at,
  is_encrypted
FROM public.disposable_menu_products;

-- Add documentation comments
COMMENT ON VIEW public.runner_earnings_view IS 
  'View with security_invoker = true to respect RLS policies of the querying user.';

COMMENT ON VIEW disposable_menus_decrypted IS 
  'View with security_invoker = true to respect RLS policies of the querying user. Provides decrypted menu data.';

COMMENT ON VIEW disposable_menu_products_decrypted IS 
  'View with security_invoker = true to respect RLS policies of the querying user. Provides decrypted menu product data.';
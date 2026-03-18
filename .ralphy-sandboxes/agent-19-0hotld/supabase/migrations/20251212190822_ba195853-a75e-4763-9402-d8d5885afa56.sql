-- Fix sync_menu_order_to_unified function to use correct column references
CREATE OR REPLACE FUNCTION public.sync_menu_order_to_unified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO unified_orders (
    id, tenant_id, order_number, order_type, source, status,
    subtotal, tax_amount, discount_amount, total_amount,
    payment_method, payment_status, menu_id, contact_name, contact_phone,
    delivery_address, metadata, created_at, updated_at
  ) VALUES (
    NEW.id,
    NEW.tenant_id,
    'MO-' || SUBSTR(NEW.id::text, 1, 8),
    'menu',
    'disposable_menu',
    COALESCE(NEW.status::text, 'pending'),
    COALESCE(NEW.total_amount, 0),
    0,
    0,
    COALESCE(NEW.total_amount, 0),
    NEW.payment_method,
    'pending',
    NEW.menu_id,
    COALESCE((NEW.order_data->>'customer_name')::text, 'Menu Customer'),
    NEW.contact_phone,
    NEW.delivery_address,
    NEW.order_data,
    NEW.created_at,
    COALESCE(NEW.processed_at, NOW())
  )
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    payment_status = EXCLUDED.payment_status,
    total_amount = EXCLUDED.total_amount,
    updated_at = NOW();
  RETURN NEW;
END;
$function$;
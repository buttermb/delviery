-- Backfill existing menu_orders into main orders table
-- Run this ONCE after the sync trigger is deployed

INSERT INTO public.orders (
  id,
  order_number,
  tenant_id,
  user_id,
  status,
  total_amount,
  delivery_address,
  customer_notes,
  created_at,
  updated_at,
  metadata
)
SELECT
  mo.id,
  'MENU-' || UPPER(SUBSTRING(mo.id::TEXT FROM 1 FOR 8)),
  dm.tenant_id,
  maw.customer_id,
  CASE mo.status
    WHEN 'pending' THEN 'pending'
    WHEN 'confirmed' THEN 'confirmed'
    WHEN 'rejected' THEN 'cancelled'
    ELSE 'pending'
  END,
  mo.total_amount,
  mo.delivery_address,
  mo.customer_notes,
  mo.created_at,
  NOW(),
  jsonb_build_object(
    'source', 'disposable_menu',
    'menu_id', mo.menu_id,
    'access_whitelist_id', mo.access_whitelist_id,
    'contact_phone', mo.contact_phone,
    'payment_method', mo.payment_method,
    'delivery_method', mo.delivery_method,
    'order_data', mo.order_data,
    'backfilled', true
  )
FROM public.menu_orders mo
JOIN public.disposable_menus dm ON dm.id = mo.menu_id
LEFT JOIN public.menu_access_whitelist maw ON maw.id = mo.access_whitelist_id
WHERE NOT EXISTS (
  -- Prevent duplicates
  SELECT 1 FROM public.orders o WHERE o.id = mo.id
)
ON CONFLICT (id) DO NOTHING;

-- Report results
DO $$
DECLARE
  backfilled_count INTEGER;
BEGIN
  GET DIAGNOSTICS backfilled_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % existing menu_orders into main orders table', backfilled_count;
END $$;

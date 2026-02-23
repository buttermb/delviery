-- ================================================================
-- TESTING SCRIPT FOR MENU ORDER INTEGRATION
-- Run these queries in Supabase SQL Editor to verify the integration
-- ================================================================

-- ================================================================
-- TEST 1: Verify Triggers Exist
-- ================================================================
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('menu_orders', 'disposable_menus')
  AND trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Expected output:
-- trigger_sync_menu_order_to_main (AFTER INSERT on menu_orders)
-- trigger_sync_menu_order_status (AFTER UPDATE on menu_orders)
-- trigger_update_inventory_from_menu_order (AFTER INSERT OR UPDATE on menu_orders)


-- ================================================================
-- TEST 2: Check if tenant_id exists on disposable_menus
-- ================================================================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'disposable_menus'
  AND column_name = 'tenant_id';

-- Expected: Should show tenant_id column with UUID type


-- ================================================================
-- TEST 3: Test Order Sync (DO NOT COMMIT - Uses Transaction)
-- ================================================================
BEGIN;

-- Get a sample menu and whitelist entry
DO $$
DECLARE
  v_menu_id UUID;
  v_whitelist_id UUID;
  v_product_id UUID;
  v_order_id UUID;
BEGIN
  -- Get first active menu
  SELECT id INTO v_menu_id
  FROM disposable_menus
  WHERE status = 'active'
  LIMIT 1;
  
  IF v_menu_id IS NULL THEN
    RAISE EXCEPTION 'No active menus found. Create a menu first.';
  END IF;
  
  -- Get first whitelist entry for this menu
  SELECT id INTO v_whitelist_id
  FROM menu_access_whitelist
  WHERE menu_id = v_menu_id
  LIMIT 1;
  
  IF v_whitelist_id IS NULL THEN
    RAISE EXCEPTION 'No whitelist entries found. Add a customer to the menu first.';
  END IF;
  
  -- Get a product
  SELECT id INTO v_product_id
  FROM wholesale_inventory
  LIMIT 1;
  
  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'No products in inventory';
  END IF;
  
  -- Insert test menu order
  INSERT INTO menu_orders (
    menu_id,
    access_whitelist_id,
    order_data,
    total_amount,
    contact_phone,
    delivery_address,
    status
  ) VALUES (
    v_menu_id,
    v_whitelist_id,
    jsonb_build_object(
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', v_product_id,
          'product_name', 'Test Product',
          'quantity', 5,
          'unit_price', 50.00,
          'total_price', 250.00
        )
      )
    ),
    250.00,
    '+1-555-TEST',
    '123 Test St, Test City, TS 12345',
    'pending'
  ) RETURNING id INTO v_order_id;
  
  RAISE NOTICE '✓ Created test menu_order: %', v_order_id;
  
  -- Check if order was synced to main orders table
  PERFORM 1 FROM orders WHERE id = v_order_id;
  
  IF FOUND THEN
    RAISE NOTICE '✓ Order successfully synced to main orders table';
  ELSE
    RAISE WARNING '✗ Order was NOT synced to main orders table';
  END IF;
  
  -- Verify order details
  RAISE NOTICE 'Order details:';
  RAISE NOTICE '%', (
    SELECT jsonb_pretty(to_jsonb(o))
    FROM orders o
    WHERE id = v_order_id
  );
END $$;

-- Rollback to avoid cluttering database
ROLLBACK;


-- ================================================================
-- TEST 4: Check Existing Orders Were Backfilled
-- ================================================================
SELECT 
  o.order_number,
  o.status,
  o.total_amount,
  o.created_at,
  o.metadata->>'source' as source,
  o.metadata->>'menu_id' as menu_id
FROM orders o
WHERE o.metadata->>'source' = 'disposable_menu'
ORDER BY o.created_at DESC
LIMIT 10;

-- Expected: Should see existing menu orders with order_number like 'MENU-XXXXXXXX'


-- ================================================================
-- TEST 5: Compare Menu Orders vs Main Orders Count
-- ================================================================
SELECT 
  'menu_orders' as table_name,
  COUNT(*) as total_orders,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed
FROM menu_orders

UNION ALL

SELECT 
  'orders (from menus)' as table_name,
  COUNT(*) as total_orders,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed
FROM orders
WHERE metadata->>'source' = 'disposable_menu';

-- Expected: Counts should match after backfill


-- ================================================================
-- TEST 6: Test Inventory Decrement (DO NOT COMMIT - Uses Transaction)
-- ================================================================
BEGIN;

DO $$
DECLARE
  v_product_id UUID;
  v_initial_qty NUMERIC;
  v_final_qty NUMERIC;
  v_order_id UUID;
BEGIN
  -- Get a product with available inventory
  SELECT id, quantity_lbs INTO v_product_id, v_initial_qty
  FROM wholesale_inventory
  WHERE quantity_lbs >= 10
  LIMIT 1;
  
  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'No products with sufficient inventory (need >= 10 lbs)';
  END IF;
  
  RAISE NOTICE 'Initial inventory: % lbs for product %', v_initial_qty, v_product_id;
  
  -- Create and immediately confirm an order
  INSERT INTO menu_orders (
    menu_id,
    access_whitelist_id,
    order_data,
    total_amount,
    contact_phone,
    status
  )
  SELECT
    (SELECT id FROM disposable_menus LIMIT 1),
    (SELECT id FROM menu_access_whitelist LIMIT 1),
    jsonb_build_object(
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', v_product_id,
          'quantity', 5
        )
      )
    ),
    100.00,
    '+1-555-TEST',
    'confirmed'  -- Immediately confirmed
  RETURNING id INTO v_order_id;
  
  RAISE NOTICE 'Created confirmed order: %', v_order_id;
  
  -- Check final inventory
  SELECT quantity_lbs INTO v_final_qty
  FROM wholesale_inventory
  WHERE id = v_product_id;
  
  IF v_final_qty = v_initial_qty - 5 THEN
    RAISE NOTICE '✓ Inventory correctly decremented: % → % lbs', v_initial_qty, v_final_qty;
  ELSE
    RAISE WARNING '✗ Inventory NOT decremented. Expected: %, Got: %', 
      v_initial_qty - 5, v_final_qty;
  END IF;
END $$;

ROLLBACK;


-- ================================================================
-- TEST 7: Verify Real-Time Subscriptions Work
-- ================================================================
-- Run this in browser console on Live Orders page:
/*
const { data, error } = await supabase
  .from('orders')
  .select('*')
  .eq('metadata->>source', 'disposable_menu')
  .order('created_at', { ascending: false })
  .limit(5);

console.log('Recent menu orders in main orders table:', data);
*/


-- ================================================================
-- CLEANUP: Remove Test Data (if needed)
-- ================================================================
-- Uncomment and run ONLY if you created test orders outside transactions:
/*
DELETE FROM orders 
WHERE metadata->>'source' = 'disposable_menu' 
  AND contact_phone = '+1-555-TEST';

DELETE FROM menu_orders
WHERE contact_phone = '+1-555-TEST';
*/

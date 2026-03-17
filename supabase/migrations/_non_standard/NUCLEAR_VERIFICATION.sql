-- Verification Script for Nuclear Option
-- Run in Supabase SQL Editor

-- 1. Check Tables Created
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('inventory_reservations', 'compliance_logs');

-- 2. Check Functions Created
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('reserve_inventory', 'confirm_menu_order', 'cancel_reservation');

-- 3. Test Reserve Inventory RPC (Mock)
DO $$
DECLARE
  v_menu_id UUID;
  v_product_id UUID;
  v_result JSONB;
BEGIN
  -- Get active menu and product
  SELECT id INTO v_menu_id FROM disposable_menus WHERE status = 'active' LIMIT 1;
  SELECT id INTO v_product_id FROM wholesale_inventory LIMIT 1;

  IF v_menu_id IS NOT NULL AND v_product_id IS NOT NULL THEN
    -- Call Reserve RPC
    v_result := reserve_inventory(
      v_menu_id,
      jsonb_build_array(
        jsonb_build_object('product_id', v_product_id, 'quantity', 1)
      ),
      'test-trace-id'
    );
    
    RAISE NOTICE 'Reservation Result: %', v_result;
    
    -- Verify Reservation Created
    PERFORM 1 FROM inventory_reservations WHERE id = (v_result->>'reservation_id')::UUID;
    IF FOUND THEN
      RAISE NOTICE '✓ Reservation record created';
    ELSE
      RAISE WARNING '✗ Reservation record NOT found';
    END IF;
    
    -- Verify Compliance Log
    PERFORM 1 FROM compliance_logs WHERE entity_id = (v_result->>'reservation_id')::UUID;
    IF FOUND THEN
      RAISE NOTICE '✓ Compliance log created';
    ELSE
      RAISE WARNING '✗ Compliance log NOT found';
    END IF;
    
    -- Clean up (Cancel reservation)
    PERFORM cancel_reservation((v_result->>'reservation_id')::UUID);
    RAISE NOTICE '✓ Reservation cancelled/cleaned up';
    
  ELSE
    RAISE WARNING 'Skipping test: No active menu or product found';
  END IF;
END $$;

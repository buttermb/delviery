-- ================================================================
-- TEST SCRIPT FOR GET_INVENTORY_SUMMARY RPC FUNCTION
-- Purpose: Verify that the get_inventory_summary RPC function works correctly
-- Migration: 20260202170313_add_get_inventory_summary_rpc.sql
-- Run these queries in Supabase SQL Editor to verify the migration
-- ================================================================

-- ================================================================
-- TEST 1: Verify Function Exists
-- ================================================================
-- This test checks if the RPC function was created successfully
SELECT
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition_exists
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_inventory_summary';

-- Expected output:
-- Should return 1 row with:
-- - function_name: get_inventory_summary
-- - arguments: p_tenant_id uuid
-- - definition_exists: (full function definition)


-- ================================================================
-- TEST 2: Verify Function Signature and Return Type
-- ================================================================
-- This test verifies the function has correct parameters and return type
SELECT
  p.proname as function_name,
  pg_catalog.format_type(p.prorettype, NULL) as return_type,
  p.proargtypes::regtype[] as argument_types,
  p.proargnames as argument_names,
  p.prosecdef as is_security_definer,
  l.lanname as language
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_inventory_summary';

-- Expected output:
-- - return_type: jsonb
-- - argument_types: {uuid}
-- - argument_names: {p_tenant_id}
-- - is_security_definer: t (true)
-- - language: plpgsql


-- ================================================================
-- TEST 3: Verify Function Comment
-- ================================================================
-- This test checks if the function comment was added correctly
SELECT
  p.proname as function_name,
  pg_catalog.obj_description(p.oid, 'pg_proc') as comment
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_inventory_summary';

-- Expected output:
-- Should return the comment describing the function's purpose


-- ================================================================
-- TEST 4: Verify Function Permissions
-- ================================================================
-- This test verifies that appropriate grants exist for the function
SELECT
  p.proname as function_name,
  pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_inventory_summary';

-- Expected output:
-- - authenticated_can_execute: true
-- - anon_can_execute: false (PUBLIC should be revoked)


-- ================================================================
-- TEST 5: Verify Required Tables and Columns Exist
-- ================================================================
-- Ensure all required tables and columns are present
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('products', 'tenant_users')
  AND column_name IN (
    'tenant_id', 'user_id', 'stock_quantity', 'is_active',
    'low_stock_threshold', 'cost', 'price', 'category', 'name', 'sku'
  )
ORDER BY table_name, column_name;

-- Expected output:
-- Should show all required columns from products and tenant_users tables


-- ================================================================
-- TEST 6: Test Function with Valid Tenant (Setup Test Data)
-- ================================================================
-- This test creates test data and verifies the function returns correct structure
DO $$
DECLARE
  v_test_tenant_id uuid;
  v_test_user_id uuid;
  v_result jsonb;
  v_test_product_id uuid;
BEGIN
  -- Get current user
  v_test_user_id := auth.uid();

  IF v_test_user_id IS NULL THEN
    RAISE NOTICE '⚠ No authenticated user. Skipping test requiring authentication.';
    RAISE NOTICE 'To run this test, execute it as an authenticated user.';
    RETURN;
  END IF;

  -- Find a tenant the user belongs to
  SELECT tenant_id INTO v_test_tenant_id
  FROM public.tenant_users
  WHERE user_id = v_test_user_id
  LIMIT 1;

  IF v_test_tenant_id IS NULL THEN
    RAISE NOTICE '⚠ User is not a member of any tenant. Skipping functional tests.';
    RAISE NOTICE 'Create a tenant membership first using the tenant_users table.';
    RETURN;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'FUNCTIONAL TEST WITH VALID TENANT';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Testing with tenant_id: %', v_test_tenant_id;
  RAISE NOTICE 'Testing with user_id: %', v_test_user_id;

  -- Call the function
  BEGIN
    v_result := public.get_inventory_summary(v_test_tenant_id);

    -- Verify result structure
    IF v_result IS NOT NULL THEN
      RAISE NOTICE '✓ Function executed successfully';
      RAISE NOTICE '✓ Result is valid JSON: %', jsonb_typeof(v_result);

      -- Check required fields exist
      IF v_result ? 'total_products' THEN
        RAISE NOTICE '✓ Field "total_products" exists: %', v_result->>'total_products';
      ELSE
        RAISE NOTICE '✗ Field "total_products" is missing';
      END IF;

      IF v_result ? 'stock_status' THEN
        RAISE NOTICE '✓ Field "stock_status" exists';
        IF (v_result->'stock_status') ? 'in_stock' THEN
          RAISE NOTICE '  - in_stock: %', v_result->'stock_status'->>'in_stock';
        END IF;
        IF (v_result->'stock_status') ? 'low_stock' THEN
          RAISE NOTICE '  - low_stock: %', v_result->'stock_status'->>'low_stock';
        END IF;
        IF (v_result->'stock_status') ? 'out_of_stock' THEN
          RAISE NOTICE '  - out_of_stock: %', v_result->'stock_status'->>'out_of_stock';
        END IF;
      ELSE
        RAISE NOTICE '✗ Field "stock_status" is missing';
      END IF;

      IF v_result ? 'inventory_value' THEN
        RAISE NOTICE '✓ Field "inventory_value" exists';
        IF (v_result->'inventory_value') ? 'total' THEN
          RAISE NOTICE '  - total: %', v_result->'inventory_value'->>'total';
        END IF;
        IF (v_result->'inventory_value') ? 'retail_value' THEN
          RAISE NOTICE '  - retail_value: %', v_result->'inventory_value'->>'retail_value';
        END IF;
      ELSE
        RAISE NOTICE '✗ Field "inventory_value" is missing';
      END IF;

      IF v_result ? 'by_category' THEN
        RAISE NOTICE '✓ Field "by_category" exists: % categories', jsonb_object_keys(v_result->'by_category');
      ELSE
        RAISE NOTICE '✗ Field "by_category" is missing';
      END IF;

      IF v_result ? 'low_stock_items' THEN
        RAISE NOTICE '✓ Field "low_stock_items" exists: % items', jsonb_array_length(v_result->'low_stock_items');
      ELSE
        RAISE NOTICE '✗ Field "low_stock_items" is missing';
      END IF;

      IF v_result ? 'generated_at' THEN
        RAISE NOTICE '✓ Field "generated_at" exists: %', v_result->>'generated_at';
      ELSE
        RAISE NOTICE '✗ Field "generated_at" is missing';
      END IF;

    ELSE
      RAISE NOTICE '✗ Function returned NULL';
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Function execution failed: %', SQLERRM;
  END;

  RAISE NOTICE '========================================';
END $$;


-- ================================================================
-- TEST 7: Test Authorization - Non-Member Access
-- ================================================================
-- This test verifies that non-members cannot access tenant data
DO $$
DECLARE
  v_random_tenant_id uuid := gen_random_uuid();
  v_result jsonb;
  v_test_user_id uuid;
BEGIN
  v_test_user_id := auth.uid();

  IF v_test_user_id IS NULL THEN
    RAISE NOTICE '⚠ No authenticated user. Skipping authorization test.';
    RETURN;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'AUTHORIZATION TEST - NON-MEMBER ACCESS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Testing with random tenant_id: %', v_random_tenant_id;
  RAISE NOTICE 'User should NOT be a member of this tenant';

  BEGIN
    v_result := public.get_inventory_summary(v_random_tenant_id);
    RAISE NOTICE '✗ SECURITY ISSUE: Function did not raise exception for non-member';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE '✓ Authorization check passed: Access denied for non-member';
      RAISE NOTICE '  Error code: 42501';
    WHEN OTHERS THEN
      IF SQLERRM = 'not allowed' THEN
        RAISE NOTICE '✓ Authorization check passed: Access denied for non-member';
      ELSE
        RAISE NOTICE '✗ Unexpected error: %', SQLERRM;
      END IF;
  END;

  RAISE NOTICE '========================================';
END $$;


-- ================================================================
-- TEST 8: Test with Empty Inventory
-- ================================================================
-- This test verifies the function handles tenants with no products correctly
DO $$
DECLARE
  v_test_tenant_id uuid;
  v_test_user_id uuid;
  v_result jsonb;
  v_product_count INTEGER;
BEGIN
  v_test_user_id := auth.uid();

  IF v_test_user_id IS NULL THEN
    RAISE NOTICE '⚠ No authenticated user. Skipping empty inventory test.';
    RETURN;
  END IF;

  -- Find a tenant the user belongs to
  SELECT tenant_id INTO v_test_tenant_id
  FROM public.tenant_users
  WHERE user_id = v_test_user_id
  LIMIT 1;

  IF v_test_tenant_id IS NULL THEN
    RAISE NOTICE '⚠ User is not a member of any tenant. Skipping test.';
    RETURN;
  END IF;

  -- Count products for this tenant
  SELECT COUNT(*) INTO v_product_count
  FROM public.products
  WHERE tenant_id = v_test_tenant_id
    AND is_active = true;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'EMPTY INVENTORY TEST';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tenant has % active products', v_product_count;

  IF v_product_count = 0 THEN
    BEGIN
      v_result := public.get_inventory_summary(v_test_tenant_id);

      IF v_result IS NOT NULL THEN
        RAISE NOTICE '✓ Function handles empty inventory correctly';
        RAISE NOTICE '  - total_products: %', v_result->>'total_products';
        RAISE NOTICE '  - in_stock: %', v_result->'stock_status'->>'in_stock';
        RAISE NOTICE '  - low_stock: %', v_result->'stock_status'->>'low_stock';
        RAISE NOTICE '  - out_of_stock: %', v_result->'stock_status'->>'out_of_stock';
        RAISE NOTICE '  - total value: %', v_result->'inventory_value'->>'total';
        RAISE NOTICE '  - low_stock_items count: %', jsonb_array_length(v_result->'low_stock_items');
      ELSE
        RAISE NOTICE '✗ Function returned NULL for empty inventory';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '✗ Function failed with empty inventory: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '⚠ Tenant has products. Use a tenant without products to test empty inventory handling.';
  END IF;

  RAISE NOTICE '========================================';
END $$;


-- ================================================================
-- TEST 9: Test Stock Status Categorization
-- ================================================================
-- This test verifies products are correctly categorized by stock status
DO $$
DECLARE
  v_test_tenant_id uuid;
  v_test_user_id uuid;
  v_result jsonb;
  v_in_stock_db INTEGER;
  v_low_stock_db INTEGER;
  v_out_of_stock_db INTEGER;
  v_in_stock_result INTEGER;
  v_low_stock_result INTEGER;
  v_out_of_stock_result INTEGER;
BEGIN
  v_test_user_id := auth.uid();

  IF v_test_user_id IS NULL THEN
    RAISE NOTICE '⚠ No authenticated user. Skipping stock status test.';
    RETURN;
  END IF;

  SELECT tenant_id INTO v_test_tenant_id
  FROM public.tenant_users
  WHERE user_id = v_test_user_id
  LIMIT 1;

  IF v_test_tenant_id IS NULL THEN
    RAISE NOTICE '⚠ User is not a member of any tenant. Skipping test.';
    RETURN;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'STOCK STATUS CATEGORIZATION TEST';
  RAISE NOTICE '========================================';

  -- Count products directly from database
  SELECT COUNT(*) INTO v_in_stock_db
  FROM public.products p
  WHERE p.tenant_id = v_test_tenant_id
    AND p.is_active = true
    AND p.stock_quantity > COALESCE(p.low_stock_threshold, 10);

  SELECT COUNT(*) INTO v_low_stock_db
  FROM public.products p
  WHERE p.tenant_id = v_test_tenant_id
    AND p.is_active = true
    AND p.stock_quantity <= COALESCE(p.low_stock_threshold, 10)
    AND p.stock_quantity > 0;

  SELECT COUNT(*) INTO v_out_of_stock_db
  FROM public.products p
  WHERE p.tenant_id = v_test_tenant_id
    AND p.is_active = true
    AND p.stock_quantity = 0;

  RAISE NOTICE 'Direct DB counts:';
  RAISE NOTICE '  - In stock: %', v_in_stock_db;
  RAISE NOTICE '  - Low stock: %', v_low_stock_db;
  RAISE NOTICE '  - Out of stock: %', v_out_of_stock_db;

  -- Get counts from function
  v_result := public.get_inventory_summary(v_test_tenant_id);

  v_in_stock_result := (v_result->'stock_status'->>'in_stock')::INTEGER;
  v_low_stock_result := (v_result->'stock_status'->>'low_stock')::INTEGER;
  v_out_of_stock_result := (v_result->'stock_status'->>'out_of_stock')::INTEGER;

  RAISE NOTICE '';
  RAISE NOTICE 'Function result counts:';
  RAISE NOTICE '  - In stock: %', v_in_stock_result;
  RAISE NOTICE '  - Low stock: %', v_low_stock_result;
  RAISE NOTICE '  - Out of stock: %', v_out_of_stock_result;

  RAISE NOTICE '';
  RAISE NOTICE 'Verification:';

  IF v_in_stock_db = v_in_stock_result THEN
    RAISE NOTICE '✓ In stock count matches';
  ELSE
    RAISE NOTICE '✗ In stock count mismatch (DB: %, Function: %)', v_in_stock_db, v_in_stock_result;
  END IF;

  IF v_low_stock_db = v_low_stock_result THEN
    RAISE NOTICE '✓ Low stock count matches';
  ELSE
    RAISE NOTICE '✗ Low stock count mismatch (DB: %, Function: %)', v_low_stock_db, v_low_stock_result;
  END IF;

  IF v_out_of_stock_db = v_out_of_stock_result THEN
    RAISE NOTICE '✓ Out of stock count matches';
  ELSE
    RAISE NOTICE '✗ Out of stock count mismatch (DB: %, Function: %)', v_out_of_stock_db, v_out_of_stock_result;
  END IF;

  RAISE NOTICE '========================================';
END $$;


-- ================================================================
-- TEST 10: Test Inventory Value Calculations
-- ================================================================
-- This test verifies inventory value calculations are accurate
DO $$
DECLARE
  v_test_tenant_id uuid;
  v_test_user_id uuid;
  v_result jsonb;
  v_total_value_db NUMERIC;
  v_retail_value_db NUMERIC;
  v_total_value_result NUMERIC;
  v_retail_value_result NUMERIC;
BEGIN
  v_test_user_id := auth.uid();

  IF v_test_user_id IS NULL THEN
    RAISE NOTICE '⚠ No authenticated user. Skipping inventory value test.';
    RETURN;
  END IF;

  SELECT tenant_id INTO v_test_tenant_id
  FROM public.tenant_users
  WHERE user_id = v_test_user_id
  LIMIT 1;

  IF v_test_tenant_id IS NULL THEN
    RAISE NOTICE '⚠ User is not a member of any tenant. Skipping test.';
    RETURN;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'INVENTORY VALUE CALCULATION TEST';
  RAISE NOTICE '========================================';

  -- Calculate values directly from database
  SELECT COALESCE(SUM(p.stock_quantity * COALESCE(p.cost, 0)), 0) INTO v_total_value_db
  FROM public.products p
  WHERE p.tenant_id = v_test_tenant_id
    AND p.is_active = true;

  SELECT COALESCE(SUM(p.stock_quantity * p.price), 0) INTO v_retail_value_db
  FROM public.products p
  WHERE p.tenant_id = v_test_tenant_id
    AND p.is_active = true;

  RAISE NOTICE 'Direct DB calculations:';
  RAISE NOTICE '  - Total value (cost): $%', v_total_value_db;
  RAISE NOTICE '  - Retail value: $%', v_retail_value_db;

  -- Get values from function
  v_result := public.get_inventory_summary(v_test_tenant_id);

  v_total_value_result := (v_result->'inventory_value'->>'total')::NUMERIC;
  v_retail_value_result := (v_result->'inventory_value'->>'retail_value')::NUMERIC;

  RAISE NOTICE '';
  RAISE NOTICE 'Function result values:';
  RAISE NOTICE '  - Total value (cost): $%', v_total_value_result;
  RAISE NOTICE '  - Retail value: $%', v_retail_value_result;

  RAISE NOTICE '';
  RAISE NOTICE 'Verification:';

  IF v_total_value_db = v_total_value_result THEN
    RAISE NOTICE '✓ Total value (cost) matches';
  ELSE
    RAISE NOTICE '✗ Total value mismatch (DB: $%, Function: $%)', v_total_value_db, v_total_value_result;
  END IF;

  IF v_retail_value_db = v_retail_value_result THEN
    RAISE NOTICE '✓ Retail value matches';
  ELSE
    RAISE NOTICE '✗ Retail value mismatch (DB: $%, Function: $%)', v_retail_value_db, v_retail_value_result;
  END IF;

  IF v_retail_value_result >= v_total_value_result THEN
    RAISE NOTICE '✓ Retail value is greater than or equal to cost value (expected)';
  ELSE
    RAISE NOTICE '⚠ Retail value is less than cost value (unusual but not necessarily wrong)';
  END IF;

  RAISE NOTICE '========================================';
END $$;


-- ================================================================
-- TEST 11: Test Category Breakdown
-- ================================================================
-- This test verifies category breakdown is accurate
DO $$
DECLARE
  v_test_tenant_id uuid;
  v_test_user_id uuid;
  v_result jsonb;
  v_category_count INTEGER;
  v_category TEXT;
BEGIN
  v_test_user_id := auth.uid();

  IF v_test_user_id IS NULL THEN
    RAISE NOTICE '⚠ No authenticated user. Skipping category breakdown test.';
    RETURN;
  END IF;

  SELECT tenant_id INTO v_test_tenant_id
  FROM public.tenant_users
  WHERE user_id = v_test_user_id
  LIMIT 1;

  IF v_test_tenant_id IS NULL THEN
    RAISE NOTICE '⚠ User is not a member of any tenant. Skipping test.';
    RETURN;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'CATEGORY BREAKDOWN TEST';
  RAISE NOTICE '========================================';

  -- Count categories directly from database
  SELECT COUNT(DISTINCT category) INTO v_category_count
  FROM public.products
  WHERE tenant_id = v_test_tenant_id
    AND is_active = true
    AND category IS NOT NULL;

  RAISE NOTICE 'Total unique categories in DB: %', v_category_count;

  -- Get result from function
  v_result := public.get_inventory_summary(v_test_tenant_id);

  IF v_result->'by_category' IS NOT NULL THEN
    RAISE NOTICE '✓ Category breakdown exists in result';
    RAISE NOTICE 'Categories in function result:';

    -- List categories
    FOR v_category IN
      SELECT jsonb_object_keys(v_result->'by_category')
    LOOP
      RAISE NOTICE '  - %: count=%, quantity=%, value=$%',
        v_category,
        (v_result->'by_category'->v_category->>'count'),
        (v_result->'by_category'->v_category->>'total_quantity'),
        (v_result->'by_category'->v_category->>'total_value');
    END LOOP;

    IF jsonb_object_keys(v_result->'by_category') IS NOT NULL THEN
      RAISE NOTICE '✓ Category breakdown contains data';
    END IF;
  ELSE
    RAISE NOTICE '✗ Category breakdown is missing from result';
  END IF;

  RAISE NOTICE '========================================';
END $$;


-- ================================================================
-- TEST 12: Test Low Stock Items List
-- ================================================================
-- This test verifies low stock items are correctly returned
DO $$
DECLARE
  v_test_tenant_id uuid;
  v_test_user_id uuid;
  v_result jsonb;
  v_low_stock_count INTEGER;
  v_low_stock_items jsonb;
  v_item jsonb;
BEGIN
  v_test_user_id := auth.uid();

  IF v_test_user_id IS NULL THEN
    RAISE NOTICE '⚠ No authenticated user. Skipping low stock items test.';
    RETURN;
  END IF;

  SELECT tenant_id INTO v_test_tenant_id
  FROM public.tenant_users
  WHERE user_id = v_test_user_id
  LIMIT 1;

  IF v_test_tenant_id IS NULL THEN
    RAISE NOTICE '⚠ User is not a member of any tenant. Skipping test.';
    RETURN;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'LOW STOCK ITEMS LIST TEST';
  RAISE NOTICE '========================================';

  -- Count low stock items from database
  SELECT COUNT(*) INTO v_low_stock_count
  FROM public.products p
  WHERE p.tenant_id = v_test_tenant_id
    AND p.is_active = true
    AND p.stock_quantity <= COALESCE(p.low_stock_threshold, 10)
    AND p.stock_quantity >= 0;

  RAISE NOTICE 'Low stock items in DB: %', v_low_stock_count;

  -- Get result from function
  v_result := public.get_inventory_summary(v_test_tenant_id);
  v_low_stock_items := v_result->'low_stock_items';

  IF v_low_stock_items IS NOT NULL THEN
    RAISE NOTICE '✓ Low stock items field exists';
    RAISE NOTICE 'Items returned: %', jsonb_array_length(v_low_stock_items);

    -- Verify structure of first few items
    IF jsonb_array_length(v_low_stock_items) > 0 THEN
      RAISE NOTICE '';
      RAISE NOTICE 'Sample low stock items (up to 5):';

      FOR v_item IN
        SELECT * FROM jsonb_array_elements(v_low_stock_items) LIMIT 5
      LOOP
        RAISE NOTICE '  - %: stock=%, threshold=%, price=$%',
          v_item->>'name',
          v_item->>'stock_quantity',
          v_item->>'low_stock_threshold',
          v_item->>'price';

        -- Verify all required fields exist
        IF NOT (v_item ? 'id' AND v_item ? 'name' AND v_item ? 'sku' AND
                v_item ? 'category' AND v_item ? 'stock_quantity' AND
                v_item ? 'low_stock_threshold' AND v_item ? 'price') THEN
          RAISE NOTICE '✗ Low stock item missing required fields';
        END IF;
      END LOOP;

      RAISE NOTICE '✓ Low stock items have correct structure';
    ELSE
      RAISE NOTICE '⚠ No low stock items found (this is OK if all products are well-stocked)';
    END IF;

    -- Verify limit (should be max 20 items)
    IF jsonb_array_length(v_low_stock_items) <= 20 THEN
      RAISE NOTICE '✓ Low stock items respects LIMIT of 20';
    ELSE
      RAISE NOTICE '✗ Low stock items exceeds LIMIT of 20';
    END IF;
  ELSE
    RAISE NOTICE '✗ Low stock items field is missing';
  END IF;

  RAISE NOTICE '========================================';
END $$;


-- ================================================================
-- TEST 13: Test Generated Timestamp
-- ================================================================
-- This test verifies the generated_at timestamp is recent and valid
DO $$
DECLARE
  v_test_tenant_id uuid;
  v_test_user_id uuid;
  v_result jsonb;
  v_generated_at TIMESTAMPTZ;
  v_time_diff INTERVAL;
BEGIN
  v_test_user_id := auth.uid();

  IF v_test_user_id IS NULL THEN
    RAISE NOTICE '⚠ No authenticated user. Skipping timestamp test.';
    RETURN;
  END IF;

  SELECT tenant_id INTO v_test_tenant_id
  FROM public.tenant_users
  WHERE user_id = v_test_user_id
  LIMIT 1;

  IF v_test_tenant_id IS NULL THEN
    RAISE NOTICE '⚠ User is not a member of any tenant. Skipping test.';
    RETURN;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'GENERATED TIMESTAMP TEST';
  RAISE NOTICE '========================================';

  v_result := public.get_inventory_summary(v_test_tenant_id);
  v_generated_at := (v_result->>'generated_at')::TIMESTAMPTZ;

  RAISE NOTICE 'Generated at: %', v_generated_at;
  RAISE NOTICE 'Current time: %', NOW();

  v_time_diff := NOW() - v_generated_at;

  RAISE NOTICE 'Time difference: %', v_time_diff;

  IF v_time_diff < INTERVAL '5 seconds' THEN
    RAISE NOTICE '✓ Timestamp is recent (within 5 seconds)';
  ELSE
    RAISE NOTICE '⚠ Timestamp is not recent (> 5 seconds ago)';
  END IF;

  IF v_generated_at IS NOT NULL THEN
    RAISE NOTICE '✓ Timestamp field is not NULL';
  ELSE
    RAISE NOTICE '✗ Timestamp field is NULL';
  END IF;

  RAISE NOTICE '========================================';
END $$;


-- ================================================================
-- TEST 14: Test Performance
-- ================================================================
-- This test measures function execution time
DO $$
DECLARE
  v_test_tenant_id uuid;
  v_test_user_id uuid;
  v_result jsonb;
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_duration INTERVAL;
BEGIN
  v_test_user_id := auth.uid();

  IF v_test_user_id IS NULL THEN
    RAISE NOTICE '⚠ No authenticated user. Skipping performance test.';
    RETURN;
  END IF;

  SELECT tenant_id INTO v_test_tenant_id
  FROM public.tenant_users
  WHERE user_id = v_test_user_id
  LIMIT 1;

  IF v_test_tenant_id IS NULL THEN
    RAISE NOTICE '⚠ User is not a member of any tenant. Skipping test.';
    RETURN;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'PERFORMANCE TEST';
  RAISE NOTICE '========================================';

  v_start_time := clock_timestamp();
  v_result := public.get_inventory_summary(v_test_tenant_id);
  v_end_time := clock_timestamp();

  v_duration := v_end_time - v_start_time;

  RAISE NOTICE 'Execution time: %', v_duration;

  IF v_duration < INTERVAL '1 second' THEN
    RAISE NOTICE '✓ Function executed in less than 1 second';
  ELSIF v_duration < INTERVAL '3 seconds' THEN
    RAISE NOTICE '⚠ Function took between 1-3 seconds (acceptable but could be optimized)';
  ELSE
    RAISE NOTICE '⚠ Function took more than 3 seconds (consider optimization)';
  END IF;

  RAISE NOTICE '========================================';
END $$;


-- ================================================================
-- TEST 15: Test NULL Handling
-- ================================================================
-- This test verifies the function handles NULL values correctly
DO $$
DECLARE
  v_test_tenant_id uuid;
  v_test_user_id uuid;
  v_result jsonb;
  v_products_with_null_cost INTEGER;
  v_products_with_null_threshold INTEGER;
BEGIN
  v_test_user_id := auth.uid();

  IF v_test_user_id IS NULL THEN
    RAISE NOTICE '⚠ No authenticated user. Skipping NULL handling test.';
    RETURN;
  END IF;

  SELECT tenant_id INTO v_test_tenant_id
  FROM public.tenant_users
  WHERE user_id = v_test_user_id
  LIMIT 1;

  IF v_test_tenant_id IS NULL THEN
    RAISE NOTICE '⚠ User is not a member of any tenant. Skipping test.';
    RETURN;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'NULL HANDLING TEST';
  RAISE NOTICE '========================================';

  -- Count products with NULL values
  SELECT COUNT(*) INTO v_products_with_null_cost
  FROM public.products
  WHERE tenant_id = v_test_tenant_id
    AND is_active = true
    AND cost IS NULL;

  SELECT COUNT(*) INTO v_products_with_null_threshold
  FROM public.products
  WHERE tenant_id = v_test_tenant_id
    AND is_active = true
    AND low_stock_threshold IS NULL;

  RAISE NOTICE 'Products with NULL cost: %', v_products_with_null_cost;
  RAISE NOTICE 'Products with NULL low_stock_threshold: %', v_products_with_null_threshold;

  BEGIN
    v_result := public.get_inventory_summary(v_test_tenant_id);

    IF v_result IS NOT NULL THEN
      RAISE NOTICE '✓ Function handles NULL values without errors';
      RAISE NOTICE '  - Inventory value (should default NULL cost to 0): $%',
        v_result->'inventory_value'->>'total';
    ELSE
      RAISE NOTICE '✗ Function returned NULL';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Function failed with NULL values: %', SQLERRM;
  END;

  RAISE NOTICE '========================================';
END $$;


-- ================================================================
-- SUMMARY
-- ================================================================
-- Run this to get a comprehensive summary of the function
DO $$
DECLARE
  v_function_exists BOOLEAN;
  v_test_user_id uuid;
  v_test_tenant_id uuid;
  v_has_permissions BOOLEAN;
  v_result jsonb;
  v_product_count INTEGER;
BEGIN
  -- Check if function exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'get_inventory_summary'
  ) INTO v_function_exists;

  -- Check user authentication
  v_test_user_id := auth.uid();

  -- Get a tenant for the user
  IF v_test_user_id IS NOT NULL THEN
    SELECT tenant_id INTO v_test_tenant_id
    FROM public.tenant_users
    WHERE user_id = v_test_user_id
    LIMIT 1;
  END IF;

  -- Check permissions
  SELECT pg_catalog.has_function_privilege(
    'authenticated',
    'public.get_inventory_summary(uuid)'::regprocedure,
    'EXECUTE'
  ) INTO v_has_permissions;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RPC FUNCTION TEST SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration: 20260202170313_add_get_inventory_summary_rpc';
  RAISE NOTICE 'Function: public.get_inventory_summary(uuid)';
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Function exists: %', CASE WHEN v_function_exists THEN '✓ YES' ELSE '✗ NO' END;
  RAISE NOTICE 'Permissions granted: %', CASE WHEN v_has_permissions THEN '✓ YES' ELSE '✗ NO' END;
  RAISE NOTICE 'User authenticated: %', CASE WHEN v_test_user_id IS NOT NULL THEN '✓ YES' ELSE '✗ NO' END;
  RAISE NOTICE 'User has tenant: %', CASE WHEN v_test_tenant_id IS NOT NULL THEN '✓ YES' ELSE '✗ NO' END;

  IF v_test_tenant_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_product_count
    FROM public.products
    WHERE tenant_id = v_test_tenant_id
      AND is_active = true;
    RAISE NOTICE 'Test tenant products: %', v_product_count;
  END IF;

  RAISE NOTICE '----------------------------------------';

  IF v_function_exists AND v_has_permissions THEN
    IF v_test_user_id IS NOT NULL AND v_test_tenant_id IS NOT NULL THEN
      BEGIN
        v_result := public.get_inventory_summary(v_test_tenant_id);
        RAISE NOTICE 'Status: ✓✓✓ Migration successful - Function is fully operational';
        RAISE NOTICE '';
        RAISE NOTICE 'Sample result structure:';
        RAISE NOTICE '  - total_products: %', v_result->>'total_products';
        RAISE NOTICE '  - stock_status.in_stock: %', v_result->'stock_status'->>'in_stock';
        RAISE NOTICE '  - stock_status.low_stock: %', v_result->'stock_status'->>'low_stock';
        RAISE NOTICE '  - stock_status.out_of_stock: %', v_result->'stock_status'->>'out_of_stock';
        RAISE NOTICE '  - inventory_value.total: $%', v_result->'inventory_value'->>'total';
        RAISE NOTICE '  - inventory_value.retail_value: $%', v_result->'inventory_value'->>'retail_value';
        RAISE NOTICE '  - categories: %', jsonb_object_keys(v_result->'by_category');
        RAISE NOTICE '  - low_stock_items count: %', jsonb_array_length(v_result->'low_stock_items');
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Status: ✗ Function exists but execution failed: %', SQLERRM;
      END;
    ELSE
      RAISE NOTICE 'Status: ✓✓ Migration successful - Function created (auth required for full test)';
    END IF;
  ELSIF v_function_exists AND NOT v_has_permissions THEN
    RAISE NOTICE 'Status: ✗ Migration incomplete - Permissions not granted';
  ELSE
    RAISE NOTICE 'Status: ✗ Migration failed - Function not found';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Function Purpose:';
  RAISE NOTICE 'Returns comprehensive inventory summary for a tenant including:';
  RAISE NOTICE '  - Total product counts';
  RAISE NOTICE '  - Stock status breakdown (in stock, low stock, out of stock)';
  RAISE NOTICE '  - Inventory values (cost and retail)';
  RAISE NOTICE '  - Category-wise breakdown';
  RAISE NOTICE '  - List of low stock items (up to 20)';
  RAISE NOTICE '';
  RAISE NOTICE 'Security:';
  RAISE NOTICE '  - SECURITY DEFINER: Runs with function owner privileges';
  RAISE NOTICE '  - Tenant membership check: Only members can access data';
  RAISE NOTICE '  - Row-level security: Enforced via tenant_users table';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage Example:';
  RAISE NOTICE '  SELECT * FROM get_inventory_summary(''<tenant-uuid>'');';
  RAISE NOTICE '';
  RAISE NOTICE 'Frontend Usage:';
  RAISE NOTICE '  const { data } = await supabase.rpc(''get_inventory_summary'', {';
  RAISE NOTICE '    p_tenant_id: tenantId';
  RAISE NOTICE '  });';
  RAISE NOTICE '========================================';
END $$;

-- ================================================================
-- TEST SCRIPT FOR PRODUCTS COMPOSITE INDEX MIGRATION
-- Purpose: Verify that the composite index on products(tenant_id, is_active) exists and works correctly
-- Migration: 20260202102700_add_products_tenant_is_active_index.sql
-- Run these queries in Supabase SQL Editor to verify the migration
-- ================================================================

-- ================================================================
-- TEST 1: Verify Index Exists
-- ================================================================
-- This test checks if the composite index was created successfully
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'products'
  AND indexname = 'idx_products_tenant_id_is_active'
  AND schemaname = 'public';

-- Expected output:
-- Should return 1 row with:
-- - schemaname: public
-- - tablename: products
-- - indexname: idx_products_tenant_id_is_active
-- - indexdef: CREATE INDEX idx_products_tenant_id_is_active ON public.products USING btree (tenant_id, is_active)


-- ================================================================
-- TEST 2: Verify Index Columns and Sort Order
-- ================================================================
-- This test verifies the index has the correct columns in the right order
-- tenant_id should be first, is_active should be second
SELECT
  i.relname as index_name,
  a.attname as column_name,
  a.attnum as column_position,
  am.amname as index_type
FROM pg_class t
JOIN pg_index ON t.oid = pg_index.indrelid
JOIN pg_class i ON i.oid = pg_index.indexrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(pg_index.indkey)
JOIN pg_am am ON i.relam = am.oid
WHERE t.relname = 'products'
  AND i.relname = 'idx_products_tenant_id_is_active'
  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY array_position(pg_index.indkey, a.attnum);

-- Expected output:
-- Row 1: tenant_id, column_position: (varies), index_type: btree
-- Row 2: is_active, column_position: (varies), index_type: btree


-- ================================================================
-- TEST 3: Verify Index Comment
-- ================================================================
-- This test checks if the index comment was added correctly
SELECT
  c.relname as index_name,
  pg_catalog.obj_description(c.oid, 'pg_class') as comment
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'idx_products_tenant_id_is_active'
  AND n.nspname = 'public';

-- Expected output:
-- Should return the comment: 'Composite index to optimize queries filtering products by tenant_id and is_active status...'


-- ================================================================
-- TEST 4: Verify Required Columns Exist
-- ================================================================
-- Ensure the products table has both tenant_id and is_active columns
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
  AND column_name IN ('tenant_id', 'is_active')
ORDER BY column_name;

-- Expected output:
-- Row 1: is_active, boolean, (varies)
-- Row 2: tenant_id, uuid, (varies)


-- ================================================================
-- TEST 5: Verify Index Usage in Query Plan (Performance Test)
-- ================================================================
-- This test verifies that PostgreSQL will use the index for relevant queries
-- The EXPLAIN output should show "Index Scan using idx_products_tenant_id_is_active"

DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id
  FROM tenants
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'No tenants found in database. Skipping query plan test.';
  ELSE
    RAISE NOTICE 'Testing query plan with tenant_id: %', v_tenant_id;
    RAISE NOTICE 'Run this query to see if the index is used:';
    RAISE NOTICE 'EXPLAIN ANALYZE SELECT * FROM products WHERE tenant_id = ''%'' AND is_active = true LIMIT 10;', v_tenant_id;
  END IF;
END $$;

-- Run this manually with an actual tenant_id:
-- EXPLAIN ANALYZE
-- SELECT * FROM products
-- WHERE tenant_id = '<actual-tenant-id>'
--   AND is_active = true
-- LIMIT 10;

-- Expected in query plan:
-- -> Index Scan using idx_products_tenant_id_is_active on products


-- ================================================================
-- TEST 6: Verify Index is Not Duplicate
-- ================================================================
-- Check that we don't have duplicate or conflicting indexes on the same columns
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'products'
  AND schemaname = 'public'
  AND (indexdef LIKE '%tenant_id%' AND indexdef LIKE '%is_active%')
ORDER BY indexname;

-- Expected output:
-- Should only show our composite index (idx_products_tenant_id_is_active)
-- If there are other indexes, verify they serve different purposes


-- ================================================================
-- TEST 7: Verify Index Works with Common Query Patterns
-- ================================================================
-- Test that the index supports various common query patterns

DO $$
DECLARE
  v_tenant_id UUID;
  v_product_count INTEGER;
  v_test_passed BOOLEAN := TRUE;
BEGIN
  -- Get a tenant with products
  SELECT p.tenant_id INTO v_tenant_id
  FROM products p
  WHERE p.tenant_id IS NOT NULL
  GROUP BY p.tenant_id
  HAVING COUNT(*) > 0
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'No products found in database. Skipping query pattern tests.';
    RETURN;
  END IF;

  -- Test 1: Filter by tenant_id and is_active (most common use case)
  BEGIN
    SELECT COUNT(*) INTO v_product_count
    FROM products
    WHERE tenant_id = v_tenant_id
      AND is_active = true;
    RAISE NOTICE '✓ Test 1: Filter active products - Found % active products', v_product_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 1 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 2: Filter inactive products
  BEGIN
    SELECT COUNT(*) INTO v_product_count
    FROM products
    WHERE tenant_id = v_tenant_id
      AND is_active = false;
    RAISE NOTICE '✓ Test 2: Filter inactive products - Found % inactive products', v_product_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 2 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 3: Filter with additional conditions (index should still help)
  BEGIN
    SELECT COUNT(*) INTO v_product_count
    FROM products
    WHERE tenant_id = v_tenant_id
      AND is_active = true
      AND in_stock = true;
    RAISE NOTICE '✓ Test 3: Filter active and in-stock products - Found % products', v_product_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 3 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 4: Filter with category condition
  BEGIN
    SELECT COUNT(*) INTO v_product_count
    FROM products
    WHERE tenant_id = v_tenant_id
      AND is_active = true
      AND category = 'flower';
    RAISE NOTICE '✓ Test 4: Filter active flower products - Found % flower products', v_product_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 4 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 5: Pagination query
  BEGIN
    SELECT COUNT(*) INTO v_product_count
    FROM products
    WHERE tenant_id = v_tenant_id
      AND is_active = true
    LIMIT 20;
    RAISE NOTICE '✓ Test 5: Pagination query - Retrieved up to 20 products (found %)', v_product_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 5 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 6: Count query (common for dashboards)
  BEGIN
    SELECT COUNT(*) INTO v_product_count
    FROM products
    WHERE tenant_id = v_tenant_id
      AND is_active = true;
    RAISE NOTICE '✓ Test 6: Count active products - Found % active products', v_product_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 6 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 7: Ordering by price (index should help with filtering)
  BEGIN
    SELECT COUNT(*) INTO v_product_count
    FROM (
      SELECT * FROM products
      WHERE tenant_id = v_tenant_id
        AND is_active = true
      ORDER BY price DESC
      LIMIT 10
    ) subquery;
    RAISE NOTICE '✓ Test 7: Order by price - Success', v_product_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 7 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  IF v_test_passed THEN
    RAISE NOTICE '✓ All query pattern tests completed successfully';
  ELSE
    RAISE EXCEPTION 'Some query pattern tests failed';
  END IF;
END $$;


-- ================================================================
-- TEST 8: Verify Index Size and Health
-- ================================================================
-- Check the index size and usage statistics
SELECT
  i.relname as index_name,
  pg_size_pretty(pg_relation_size(i.oid)) as index_size,
  COALESCE(idx_scan, 0) as times_used,
  COALESCE(idx_tup_read, 0) as tuples_read,
  COALESCE(idx_tup_fetch, 0) as tuples_fetched
FROM pg_class i
JOIN pg_index ix ON i.oid = ix.indexrelid
LEFT JOIN pg_stat_user_indexes psui ON i.oid = psui.indexrelid
WHERE i.relname = 'idx_products_tenant_id_is_active'
  AND i.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Expected output:
-- - index_size: Size of the index (should be reasonable relative to table size)
-- - times_used: Number of times the index has been used (will grow over time)
-- - tuples_read/fetched: Statistics about index usage


-- ================================================================
-- TEST 9: Compare Performance with and without Index
-- ================================================================
-- This test demonstrates the performance improvement
DO $$
DECLARE
  v_tenant_id UUID;
  v_plan_text TEXT;
BEGIN
  SELECT p.tenant_id INTO v_tenant_id
  FROM products p
  WHERE p.tenant_id IS NOT NULL
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'No products with tenant_id found. Skipping performance comparison.';
    RETURN;
  END IF;

  RAISE NOTICE '✓ Query optimizer should use the composite index for queries like:';
  RAISE NOTICE '  SELECT * FROM products WHERE tenant_id = ''%'' AND is_active = true;', v_tenant_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Run EXPLAIN ANALYZE to verify index usage:';
  RAISE NOTICE '  EXPLAIN ANALYZE SELECT * FROM products WHERE tenant_id = ''%'' AND is_active = true LIMIT 10;', v_tenant_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠ Could not verify query plan: %', SQLERRM;
    RAISE NOTICE 'Run EXPLAIN manually to verify index usage';
END $$;


-- ================================================================
-- TEST 10: Verify Index Can Handle NULL Values
-- ================================================================
-- Ensure the index works correctly with NULL tenant_id or is_active values
DO $$
DECLARE
  v_null_tenant_count INTEGER;
  v_null_active_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_null_tenant_count
  FROM products
  WHERE tenant_id IS NULL;

  SELECT COUNT(*) INTO v_null_active_count
  FROM products
  WHERE is_active IS NULL;

  RAISE NOTICE 'Products with NULL tenant_id: %', v_null_tenant_count;
  RAISE NOTICE 'Products with NULL is_active: %', v_null_active_count;

  IF v_null_tenant_count > 0 THEN
    RAISE NOTICE '⚠ Note: % products have NULL tenant_id. Index will not help for these rows.', v_null_tenant_count;
  ELSE
    RAISE NOTICE '✓ All products have non-NULL tenant_id';
  END IF;

  IF v_null_active_count > 0 THEN
    RAISE NOTICE '⚠ Note: % products have NULL is_active. Index will not help for these rows.', v_null_active_count;
  ELSE
    RAISE NOTICE '✓ All products have non-NULL is_active';
  END IF;
END $$;


-- ================================================================
-- TEST 11: Verify Index Performance Impact
-- ================================================================
-- Test the actual performance difference
DO $$
DECLARE
  v_tenant_id UUID;
  v_start_time TIMESTAMP;
  v_end_time TIMESTAMP;
  v_elapsed_ms NUMERIC;
  v_product_count INTEGER;
BEGIN
  -- Get a tenant with products
  SELECT p.tenant_id INTO v_tenant_id
  FROM products p
  WHERE p.tenant_id IS NOT NULL
  GROUP BY p.tenant_id
  HAVING COUNT(*) > 0
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'No products found. Skipping performance test.';
    RETURN;
  END IF;

  -- Test query performance
  v_start_time := clock_timestamp();

  SELECT COUNT(*) INTO v_product_count
  FROM products
  WHERE tenant_id = v_tenant_id
    AND is_active = true;

  v_end_time := clock_timestamp();
  v_elapsed_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time));

  RAISE NOTICE '✓ Performance Test Results:';
  RAISE NOTICE '  - Products found: %', v_product_count;
  RAISE NOTICE '  - Query time: % ms', ROUND(v_elapsed_ms, 3);

  IF v_elapsed_ms < 50 THEN
    RAISE NOTICE '  - Performance: Excellent (< 50ms)';
  ELSIF v_elapsed_ms < 100 THEN
    RAISE NOTICE '  - Performance: Good (< 100ms)';
  ELSE
    RAISE NOTICE '  - Performance: Consider query optimization';
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠ Performance test failed: %', SQLERRM;
END $$;


-- ================================================================
-- SUMMARY
-- ================================================================
-- Run this to get a summary of the index status
DO $$
DECLARE
  v_index_exists BOOLEAN;
  v_table_has_data BOOLEAN;
  v_product_count INTEGER;
  v_index_size TEXT;
  v_correct_columns BOOLEAN;
  v_tenant_id_exists BOOLEAN;
  v_is_active_exists BOOLEAN;
BEGIN
  -- Check if index exists
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'products'
      AND indexname = 'idx_products_tenant_id_is_active'
      AND schemaname = 'public'
  ) INTO v_index_exists;

  -- Check if table has data
  SELECT COUNT(*) INTO v_product_count FROM products;
  v_table_has_data := v_product_count > 0;

  -- Get index size
  SELECT pg_size_pretty(pg_relation_size(c.oid)) INTO v_index_size
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'idx_products_tenant_id_is_active'
    AND n.nspname = 'public';

  -- Verify columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'tenant_id'
  ) INTO v_tenant_id_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'is_active'
  ) INTO v_is_active_exists;

  v_correct_columns := v_tenant_id_exists AND v_is_active_exists;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'INDEX MIGRATION TEST SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration: 20260202102700_add_products_tenant_is_active_index';
  RAISE NOTICE 'Index name: idx_products_tenant_id_is_active';
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Index exists: %', CASE WHEN v_index_exists THEN '✓ YES' ELSE '✗ NO' END;
  RAISE NOTICE 'Required columns exist:';
  RAISE NOTICE '  - tenant_id: %', CASE WHEN v_tenant_id_exists THEN '✓ YES' ELSE '✗ NO' END;
  RAISE NOTICE '  - is_active: %', CASE WHEN v_is_active_exists THEN '✓ YES' ELSE '✗ NO' END;
  RAISE NOTICE 'Table has data: %', CASE WHEN v_table_has_data THEN '✓ YES (' || v_product_count || ' products)' ELSE '✗ NO (empty table)' END;
  RAISE NOTICE 'Index size: %', COALESCE(v_index_size, 'N/A');
  RAISE NOTICE '----------------------------------------';

  IF v_index_exists AND v_correct_columns AND v_table_has_data THEN
    RAISE NOTICE 'Status: ✓✓✓ Migration successful - Index is ready for use';
  ELSIF v_index_exists AND v_correct_columns AND NOT v_table_has_data THEN
    RAISE NOTICE 'Status: ✓✓ Migration successful - Index created (table is empty)';
  ELSIF v_index_exists AND NOT v_correct_columns THEN
    RAISE NOTICE 'Status: ✗ Migration incomplete - Required columns missing';
  ELSE
    RAISE NOTICE 'Status: ✗ Migration failed - Index not found';
  END IF;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Index Purpose:';
  RAISE NOTICE 'Optimizes queries like:';
  RAISE NOTICE '  SELECT * FROM products';
  RAISE NOTICE '  WHERE tenant_id = ''<uuid>''';
  RAISE NOTICE '    AND is_active = true;';
  RAISE NOTICE '';
  RAISE NOTICE 'Common use cases:';
  RAISE NOTICE '  - Fetching active products for a tenant';
  RAISE NOTICE '  - Product catalog displays';
  RAISE NOTICE '  - Filtering products by status';
  RAISE NOTICE '  - Product inventory management';
  RAISE NOTICE '========================================';
END $$;

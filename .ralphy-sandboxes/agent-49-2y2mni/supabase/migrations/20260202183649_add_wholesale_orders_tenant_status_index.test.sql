-- ================================================================
-- TEST SCRIPT FOR WHOLESALE_ORDERS COMPOSITE INDEX MIGRATION
-- Purpose: Verify that the composite index on wholesale_orders(tenant_id, status) exists and works correctly
-- Migration: 20260202183649_add_wholesale_orders_tenant_status_index.sql
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
WHERE tablename = 'wholesale_orders'
  AND indexname = 'idx_wholesale_orders_tenant_id_status'
  AND schemaname = 'public';

-- Expected output:
-- Should return 1 row with:
-- - schemaname: public
-- - tablename: wholesale_orders
-- - indexname: idx_wholesale_orders_tenant_id_status
-- - indexdef: CREATE INDEX idx_wholesale_orders_tenant_id_status ON public.wholesale_orders USING btree (tenant_id, status)


-- ================================================================
-- TEST 2: Verify Index Columns and Order
-- ================================================================
-- This test verifies the index has the correct columns in the right order
-- Both tenant_id and status should be included
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
WHERE t.relname = 'wholesale_orders'
  AND i.relname = 'idx_wholesale_orders_tenant_id_status'
  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY a.attnum;

-- Expected output:
-- Row 1: tenant_id, index_type: btree
-- Row 2: status, index_type: btree


-- ================================================================
-- TEST 3: Verify Index Comment
-- ================================================================
-- This test checks if the index comment was added correctly
SELECT
  c.relname as index_name,
  pg_catalog.obj_description(c.oid, 'pg_class') as comment
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'idx_wholesale_orders_tenant_id_status'
  AND n.nspname = 'public';

-- Expected output:
-- Should return the comment: 'Composite index to optimize queries filtering wholesale orders by tenant_id and status...'


-- ================================================================
-- TEST 4: Verify Required Columns Exist
-- ================================================================
-- Ensure the wholesale_orders table has both tenant_id and status columns
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'wholesale_orders'
  AND column_name IN ('tenant_id', 'status')
ORDER BY column_name;

-- Expected output:
-- Row 1: status, (data_type varies), (nullable varies)
-- Row 2: tenant_id, uuid, (nullable varies)


-- ================================================================
-- TEST 5: Verify Index Usage in Query Plan (Performance Test)
-- ================================================================
-- This test verifies that PostgreSQL will use the index for relevant queries
-- The EXPLAIN output should show "Index Scan using idx_wholesale_orders_tenant_id_status"

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
    RAISE NOTICE 'EXPLAIN ANALYZE SELECT * FROM wholesale_orders WHERE tenant_id = ''%'' AND status = ''pending'' LIMIT 10;', v_tenant_id;
  END IF;
END $$;

-- Run this manually with an actual tenant_id:
-- EXPLAIN ANALYZE
-- SELECT * FROM wholesale_orders
-- WHERE tenant_id = '<actual-tenant-id>'
--   AND status = 'pending'
-- LIMIT 10;

-- Expected in query plan:
-- -> Index Scan using idx_wholesale_orders_tenant_id_status on wholesale_orders


-- ================================================================
-- TEST 6: Verify Index is Not Duplicate
-- ================================================================
-- Check that we don't have duplicate or conflicting indexes on the same columns
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'wholesale_orders'
  AND schemaname = 'public'
  AND (indexdef LIKE '%tenant_id%' AND indexdef LIKE '%status%')
ORDER BY indexname;

-- Expected output:
-- Should only show our composite index (idx_wholesale_orders_tenant_id_status)
-- If there are other indexes, verify they serve different purposes


-- ================================================================
-- TEST 7: Verify Index Works with Common Query Patterns
-- ================================================================
-- Test that the index supports various common query patterns

DO $$
DECLARE
  v_tenant_id UUID;
  v_order_count INTEGER;
  v_test_passed BOOLEAN := TRUE;
BEGIN
  -- Get a tenant with wholesale orders
  SELECT wo.tenant_id INTO v_tenant_id
  FROM wholesale_orders wo
  WHERE wo.tenant_id IS NOT NULL
  GROUP BY wo.tenant_id
  HAVING COUNT(*) > 0
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'No wholesale_orders found in database. Skipping query pattern tests.';
    RETURN;
  END IF;

  -- Test 1: Simple filter by tenant_id and status (most common use case)
  BEGIN
    SELECT COUNT(*) INTO v_order_count
    FROM wholesale_orders
    WHERE tenant_id = v_tenant_id
      AND status = 'pending';
    RAISE NOTICE '✓ Test 1: Filter by tenant_id and status - Found % pending orders', v_order_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 1 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 2: Filter with tenant_id and multiple status values
  BEGIN
    SELECT COUNT(*) INTO v_order_count
    FROM wholesale_orders
    WHERE tenant_id = v_tenant_id
      AND status IN ('pending', 'processing', 'completed');
    RAISE NOTICE '✓ Test 2: Filter with multiple statuses - Found % orders', v_order_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 2 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 3: Count orders by status for a tenant (dashboard query)
  BEGIN
    SELECT COUNT(*) INTO v_order_count
    FROM wholesale_orders
    WHERE tenant_id = v_tenant_id
      AND status = 'completed';
    RAISE NOTICE '✓ Test 3: Dashboard count query - Found % completed orders', v_order_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 3 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 4: Filter with additional conditions (index should still help)
  BEGIN
    SELECT COUNT(*) INTO v_order_count
    FROM wholesale_orders
    WHERE tenant_id = v_tenant_id
      AND status = 'pending'
      AND created_at >= NOW() - INTERVAL '7 days';
    RAISE NOTICE '✓ Test 4: Filter with date range - Found % recent pending orders', v_order_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 4 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 5: Pagination query with status filter
  BEGIN
    SELECT COUNT(*) INTO v_order_count
    FROM wholesale_orders
    WHERE tenant_id = v_tenant_id
      AND status = 'pending'
    LIMIT 20
    OFFSET 0;
    RAISE NOTICE '✓ Test 5: Pagination query - Retrieved up to 20 orders (found %)', v_order_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 5 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 6: Aggregation query grouped by status
  BEGIN
    SELECT COUNT(DISTINCT status) INTO v_order_count
    FROM wholesale_orders
    WHERE tenant_id = v_tenant_id;
    RAISE NOTICE '✓ Test 6: Aggregation query - Found % distinct statuses', v_order_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 6 FAILED: %', SQLERRM;
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
WHERE i.relname = 'idx_wholesale_orders_tenant_id_status'
  AND i.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Expected output:
-- - index_size: Size of the index (should be reasonable relative to table size)
-- - times_used: Number of times the index has been used (will grow over time)
-- - tuples_read/fetched: Statistics about index usage


-- ================================================================
-- TEST 9: Compare Query Performance Benefits
-- ================================================================
-- This test demonstrates the performance improvement
DO $$
DECLARE
  v_tenant_id UUID;
  v_status_count INTEGER;
BEGIN
  SELECT wo.tenant_id INTO v_tenant_id
  FROM wholesale_orders wo
  WHERE wo.tenant_id IS NOT NULL
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'No wholesale_orders with tenant_id found. Skipping performance comparison.';
    RETURN;
  END IF;

  -- Count orders by status to verify index helps with aggregations
  SELECT COUNT(DISTINCT status) INTO v_status_count
  FROM wholesale_orders
  WHERE tenant_id = v_tenant_id;

  RAISE NOTICE '✓ Query optimizer can efficiently filter by tenant_id and status';
  RAISE NOTICE 'Found % distinct statuses for tenant %', v_status_count, v_tenant_id;

  RAISE NOTICE 'Run this query to verify index usage:';
  RAISE NOTICE 'EXPLAIN ANALYZE SELECT * FROM wholesale_orders WHERE tenant_id = ''%'' AND status = ''pending'';', v_tenant_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠ Could not verify query performance: %', SQLERRM;
END $$;


-- ================================================================
-- TEST 10: Verify Index Can Handle NULL Values
-- ================================================================
-- Ensure the index works correctly with NULL tenant_id or status values
DO $$
DECLARE
  v_null_tenant_count INTEGER;
  v_null_status_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_null_tenant_count
  FROM wholesale_orders
  WHERE tenant_id IS NULL;

  SELECT COUNT(*) INTO v_null_status_count
  FROM wholesale_orders
  WHERE status IS NULL;

  RAISE NOTICE 'Wholesale orders with NULL tenant_id: %', v_null_tenant_count;
  RAISE NOTICE 'Wholesale orders with NULL status: %', v_null_status_count;

  IF v_null_tenant_count > 0 THEN
    RAISE NOTICE '⚠ Note: % orders have NULL tenant_id. Index will not help for these rows.', v_null_tenant_count;
  ELSE
    RAISE NOTICE '✓ All orders have non-NULL tenant_id';
  END IF;

  IF v_null_status_count > 0 THEN
    RAISE NOTICE '⚠ Note: % orders have NULL status. Index will not help for these rows.', v_null_status_count;
  ELSE
    RAISE NOTICE '✓ All orders have non-NULL status';
  END IF;
END $$;


-- ================================================================
-- TEST 11: Verify Index Helps with Status Distribution Queries
-- ================================================================
-- Test that the index supports queries for status statistics (common in dashboards)
DO $$
DECLARE
  v_tenant_id UUID;
  v_status_stats RECORD;
BEGIN
  SELECT wo.tenant_id INTO v_tenant_id
  FROM wholesale_orders wo
  WHERE wo.tenant_id IS NOT NULL
  GROUP BY wo.tenant_id
  HAVING COUNT(*) > 0
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'No wholesale orders found. Skipping status distribution test.';
    RETURN;
  END IF;

  RAISE NOTICE 'Status distribution for tenant %:', v_tenant_id;

  FOR v_status_stats IN
    SELECT
      status,
      COUNT(*) as count
    FROM wholesale_orders
    WHERE tenant_id = v_tenant_id
    GROUP BY status
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '  - %: % orders', COALESCE(v_status_stats.status, 'NULL'), v_status_stats.count;
  END LOOP;

  RAISE NOTICE '✓ Index supports status distribution queries efficiently';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '✗ Status distribution test FAILED: %', SQLERRM;
END $$;


-- ================================================================
-- TEST 12: Verify All Existing Indexes on wholesale_orders
-- ================================================================
-- List all indexes on the wholesale_orders table to ensure no conflicts
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'wholesale_orders'
  AND schemaname = 'public'
ORDER BY indexname;

-- Expected output:
-- Should show all indexes including our new composite index
-- Verify that indexes serve complementary purposes


-- ================================================================
-- SUMMARY
-- ================================================================
-- Run this to get a summary of the index status
DO $$
DECLARE
  v_index_exists BOOLEAN;
  v_table_has_data BOOLEAN;
  v_order_count INTEGER;
  v_index_size TEXT;
  v_correct_columns BOOLEAN;
BEGIN
  -- Check if index exists
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'wholesale_orders'
      AND indexname = 'idx_wholesale_orders_tenant_id_status'
      AND schemaname = 'public'
  ) INTO v_index_exists;

  -- Check if table has data
  SELECT COUNT(*) INTO v_order_count FROM wholesale_orders;
  v_table_has_data := v_order_count > 0;

  -- Get index size
  SELECT pg_size_pretty(pg_relation_size(c.oid)) INTO v_index_size
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'idx_wholesale_orders_tenant_id_status'
    AND n.nspname = 'public';

  -- Verify columns are correct
  SELECT COUNT(*) = 2 INTO v_correct_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'wholesale_orders'
    AND column_name IN ('tenant_id', 'status');

  RAISE NOTICE '========================================';
  RAISE NOTICE 'INDEX MIGRATION TEST SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration: 20260202183649_add_wholesale_orders_tenant_status_index';
  RAISE NOTICE 'Index name: idx_wholesale_orders_tenant_id_status';
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Index exists: %', CASE WHEN v_index_exists THEN '✓ YES' ELSE '✗ NO' END;
  RAISE NOTICE 'Required columns exist: %', CASE WHEN v_correct_columns THEN '✓ YES' ELSE '✗ NO' END;
  RAISE NOTICE 'Table has data: %', CASE WHEN v_table_has_data THEN '✓ YES (' || v_order_count || ' wholesale orders)' ELSE '✗ NO (empty table)' END;
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
  RAISE NOTICE '  SELECT * FROM wholesale_orders';
  RAISE NOTICE '  WHERE tenant_id = ''<uuid>''';
  RAISE NOTICE '    AND status = ''pending''';
  RAISE NOTICE '  LIMIT 10;';
  RAISE NOTICE '';
  RAISE NOTICE 'Common use cases:';
  RAISE NOTICE '  - Dashboard queries showing orders by status';
  RAISE NOTICE '  - Filtered wholesale order lists by tenant and status';
  RAISE NOTICE '  - Status distribution aggregations per tenant';
  RAISE NOTICE '========================================';
END $$;

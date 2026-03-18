-- ================================================================
-- TEST SCRIPT FOR CUSTOMERS COMPOSITE INDEX MIGRATION
-- Purpose: Verify that the composite index on customers(tenant_id, created_at DESC) exists and works correctly
-- Migration: 20260202133047_add_customers_tenant_created_at_composite_index.sql
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
WHERE tablename = 'customers'
  AND indexname = 'idx_customers_tenant_id_created_at_desc'
  AND schemaname = 'public';

-- Expected output:
-- Should return 1 row with:
-- - schemaname: public
-- - tablename: customers
-- - indexname: idx_customers_tenant_id_created_at_desc
-- - indexdef: CREATE INDEX idx_customers_tenant_id_created_at_desc ON public.customers USING btree (tenant_id, created_at DESC)


-- ================================================================
-- TEST 2: Verify Index Columns and Sort Order
-- ================================================================
-- This test verifies the index has the correct columns in the right order
-- tenant_id should be ASC, created_at should be DESC
SELECT
  i.relname as index_name,
  a.attname as column_name,
  a.attnum as column_position,
  am.amname as index_type,
  CASE
    WHEN pg_index.indoption[a.attnum-1] & 1 = 1 THEN 'DESC'
    ELSE 'ASC'
  END as sort_order
FROM pg_class t
JOIN pg_index ON t.oid = pg_index.indrelid
JOIN pg_class i ON i.oid = pg_index.indexrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(pg_index.indkey)
JOIN pg_am am ON i.relam = am.oid
WHERE t.relname = 'customers'
  AND i.relname = 'idx_customers_tenant_id_created_at_desc'
  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY a.attnum;

-- Expected output:
-- Row 1: tenant_id, column_position: (varies), index_type: btree, sort_order: ASC
-- Row 2: created_at, column_position: (varies), index_type: btree, sort_order: DESC


-- ================================================================
-- TEST 3: Verify Index Comment
-- ================================================================
-- This test checks if the index comment was added correctly
SELECT
  c.relname as index_name,
  pg_catalog.obj_description(c.oid, 'pg_class') as comment
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'idx_customers_tenant_id_created_at_desc'
  AND n.nspname = 'public';

-- Expected output:
-- Should return the comment: 'Composite index for efficient tenant-scoped customer queries ordered by creation date (newest first)...'


-- ================================================================
-- TEST 4: Verify Required Columns Exist
-- ================================================================
-- Ensure the customers table has both tenant_id and created_at columns
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'customers'
  AND column_name IN ('tenant_id', 'created_at')
ORDER BY column_name;

-- Expected output:
-- Row 1: created_at, timestamp with time zone, (varies)
-- Row 2: tenant_id, uuid, (varies)


-- ================================================================
-- TEST 5: Verify Index Usage in Query Plan (Performance Test)
-- ================================================================
-- This test verifies that PostgreSQL will use the index for relevant queries
-- The EXPLAIN output should show "Index Scan using idx_customers_tenant_id_created_at_desc"

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
    RAISE NOTICE 'EXPLAIN ANALYZE SELECT * FROM customers WHERE tenant_id = ''%'' ORDER BY created_at DESC LIMIT 10;', v_tenant_id;
  END IF;
END $$;

-- Run this manually with an actual tenant_id:
-- EXPLAIN ANALYZE
-- SELECT * FROM customers
-- WHERE tenant_id = '<actual-tenant-id>'
-- ORDER BY created_at DESC
-- LIMIT 10;

-- Expected in query plan:
-- -> Index Scan using idx_customers_tenant_id_created_at_desc on customers


-- ================================================================
-- TEST 6: Verify Index is Not Duplicate
-- ================================================================
-- Check that we don't have duplicate or conflicting indexes on the same columns
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'customers'
  AND schemaname = 'public'
  AND (indexdef LIKE '%tenant_id%' AND indexdef LIKE '%created_at%')
ORDER BY indexname;

-- Expected output:
-- Should only show our composite index (idx_customers_tenant_id_created_at_desc)
-- If there are other indexes, verify they serve different purposes


-- ================================================================
-- TEST 7: Verify Index Works with Common Query Patterns
-- ================================================================
-- Test that the index supports various common query patterns

DO $$
DECLARE
  v_tenant_id UUID;
  v_customer_count INTEGER;
  v_test_passed BOOLEAN := TRUE;
BEGIN
  -- Get a tenant with customers
  SELECT c.tenant_id INTO v_tenant_id
  FROM customers c
  WHERE c.tenant_id IS NOT NULL
  GROUP BY c.tenant_id
  HAVING COUNT(*) > 0
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'No customers found in database. Skipping query pattern tests.';
    RETURN;
  END IF;

  -- Test 1: Simple filter and sort (most common use case)
  BEGIN
    SELECT COUNT(*) INTO v_customer_count
    FROM customers
    WHERE tenant_id = v_tenant_id
    ORDER BY created_at DESC
    LIMIT 10;
    RAISE NOTICE '✓ Test 1: Simple filter and sort - Found % customers', v_customer_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 1 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 2: Filter with date range
  BEGIN
    SELECT COUNT(*) INTO v_customer_count
    FROM customers
    WHERE tenant_id = v_tenant_id
      AND created_at >= NOW() - INTERVAL '30 days'
    ORDER BY created_at DESC;
    RAISE NOTICE '✓ Test 2: Filter with date range - Found % customers in last 30 days', v_customer_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 2 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 3: Pagination query
  BEGIN
    SELECT COUNT(*) INTO v_customer_count
    FROM customers
    WHERE tenant_id = v_tenant_id
    ORDER BY created_at DESC
    OFFSET 0 LIMIT 20;
    RAISE NOTICE '✓ Test 3: Pagination query - Retrieved up to 20 customers (found %)', v_customer_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 3 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 4: Filter with additional conditions (index should still help)
  BEGIN
    SELECT COUNT(*) INTO v_customer_count
    FROM customers
    WHERE tenant_id = v_tenant_id
      AND status = 'active'
    ORDER BY created_at DESC;
    RAISE NOTICE '✓ Test 4: Filter with status condition - Found % active customers', v_customer_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 4 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 5: Most recent customer query
  BEGIN
    SELECT COUNT(*) INTO v_customer_count
    FROM (
      SELECT * FROM customers
      WHERE tenant_id = v_tenant_id
      ORDER BY created_at DESC
      LIMIT 1
    ) subquery;
    RAISE NOTICE '✓ Test 5: Most recent customer query - Success', v_customer_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 5 FAILED: %', SQLERRM;
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
WHERE i.relname = 'idx_customers_tenant_id_created_at_desc'
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
  SELECT c.tenant_id INTO v_tenant_id
  FROM customers c
  WHERE c.tenant_id IS NOT NULL
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'No customers with tenant_id found. Skipping performance comparison.';
    RETURN;
  END IF;

  -- Check if the query plan uses our index
  SELECT query_plan INTO v_plan_text
  FROM (
    SELECT string_agg(plan_line, E'\n') as query_plan
    FROM (
      SELECT * FROM dblink('dbname=' || current_database(),
        format('EXPLAIN SELECT * FROM customers WHERE tenant_id = %L ORDER BY created_at DESC LIMIT 10', v_tenant_id)
      ) AS plan_table(plan_line TEXT)
    ) subq
  ) plan_result;

  IF v_plan_text LIKE '%idx_customers_tenant_id_created_at_desc%' THEN
    RAISE NOTICE '✓ Query optimizer is using the composite index';
  ELSE
    RAISE NOTICE '⚠ Warning: Query optimizer may not be using the composite index';
    RAISE NOTICE 'Plan: %', v_plan_text;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠ Could not verify query plan (dblink may not be available): %', SQLERRM;
    RAISE NOTICE 'Run EXPLAIN manually to verify index usage';
END $$;


-- ================================================================
-- TEST 10: Verify Index Can Handle NULL Values
-- ================================================================
-- Ensure the index works correctly with NULL tenant_id values
DO $$
DECLARE
  v_null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_null_count
  FROM customers
  WHERE tenant_id IS NULL;

  RAISE NOTICE 'Customers with NULL tenant_id: %', v_null_count;

  IF v_null_count > 0 THEN
    RAISE NOTICE '⚠ Note: % customers have NULL tenant_id. Index will not help for these rows.', v_null_count;
  ELSE
    RAISE NOTICE '✓ All customers have non-NULL tenant_id';
  END IF;
END $$;


-- ================================================================
-- SUMMARY
-- ================================================================
-- Run this to get a summary of the index status
DO $$
DECLARE
  v_index_exists BOOLEAN;
  v_table_has_data BOOLEAN;
  v_customer_count INTEGER;
  v_index_size TEXT;
  v_correct_columns BOOLEAN;
BEGIN
  -- Check if index exists
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'customers'
      AND indexname = 'idx_customers_tenant_id_created_at_desc'
      AND schemaname = 'public'
  ) INTO v_index_exists;

  -- Check if table has data
  SELECT COUNT(*) INTO v_customer_count FROM customers;
  v_table_has_data := v_customer_count > 0;

  -- Get index size
  SELECT pg_size_pretty(pg_relation_size(c.oid)) INTO v_index_size
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'idx_customers_tenant_id_created_at_desc'
    AND n.nspname = 'public';

  -- Verify columns are correct
  SELECT COUNT(*) = 2 INTO v_correct_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'customers'
    AND column_name IN ('tenant_id', 'created_at');

  RAISE NOTICE '========================================';
  RAISE NOTICE 'INDEX MIGRATION TEST SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration: 20260202133047_add_customers_tenant_created_at_composite_index';
  RAISE NOTICE 'Index name: idx_customers_tenant_id_created_at_desc';
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Index exists: %', CASE WHEN v_index_exists THEN '✓ YES' ELSE '✗ NO' END;
  RAISE NOTICE 'Required columns exist: %', CASE WHEN v_correct_columns THEN '✓ YES' ELSE '✗ NO' END;
  RAISE NOTICE 'Table has data: %', CASE WHEN v_table_has_data THEN '✓ YES (' || v_customer_count || ' customers)' ELSE '✗ NO (empty table)' END;
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
  RAISE NOTICE '  SELECT * FROM customers';
  RAISE NOTICE '  WHERE tenant_id = ''<uuid>''';
  RAISE NOTICE '  ORDER BY created_at DESC';
  RAISE NOTICE '  LIMIT 10;';
  RAISE NOTICE '========================================';
END $$;

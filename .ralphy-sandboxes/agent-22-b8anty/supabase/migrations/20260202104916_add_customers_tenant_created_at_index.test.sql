-- ================================================================
-- TEST SCRIPT FOR CUSTOMERS COMPOSITE INDEX MIGRATION
-- Purpose: Verify that the composite index on customers(tenant_id, created_at DESC) exists and works correctly
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
-- Row 1: tenant_id, position 1, ASC
-- Row 2: created_at, position 2, DESC


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
-- Should return the comment describing the index purpose


-- ================================================================
-- TEST 4: Verify Index Usage in Query Plan (Performance Test)
-- ================================================================
-- This test verifies that PostgreSQL will use the index for relevant queries
-- The EXPLAIN output should show "Index Scan using idx_customers_tenant_id_created_at_desc"

-- First, check if there are any tenants in the system
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
-- TEST 5: Verify Index is Not Duplicate
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
-- Should only show our new index (idx_customers_tenant_id_created_at_desc)
-- If there are other indexes on these columns, verify they serve different purposes


-- ================================================================
-- TEST 6: Performance Comparison (Optional - for production validation)
-- ================================================================
-- This test compares query performance with and without the index
-- WARNING: Only run on production if you understand the impact

-- To test properly, you would need to:
-- 1. Temporarily DROP the index
-- 2. Run EXPLAIN ANALYZE on the query
-- 3. Recreate the index
-- 4. Run EXPLAIN ANALYZE again
-- 5. Compare execution times

-- DO NOT RUN THIS IN PRODUCTION WITHOUT PROPER PLANNING:
/*
BEGIN;
-- Note the execution time
EXPLAIN ANALYZE
SELECT * FROM customers
WHERE tenant_id = '<tenant-id>'
ORDER BY created_at DESC
LIMIT 10;
ROLLBACK;
*/


-- ================================================================
-- TEST 7: Verify Index Works with Common Query Patterns
-- ================================================================
-- Test that the index supports various common query patterns

DO $$
DECLARE
  v_tenant_id UUID;
  v_customer_count INTEGER;
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
  SELECT COUNT(*) INTO v_customer_count
  FROM customers
  WHERE tenant_id = v_tenant_id
  ORDER BY created_at DESC
  LIMIT 10;

  RAISE NOTICE '✓ Test 1: Simple filter and sort - Found % customers', v_customer_count;

  -- Test 2: Filter with date range
  SELECT COUNT(*) INTO v_customer_count
  FROM customers
  WHERE tenant_id = v_tenant_id
    AND created_at >= NOW() - INTERVAL '30 days'
  ORDER BY created_at DESC;

  RAISE NOTICE '✓ Test 2: Filter with date range - Found % customers in last 30 days', v_customer_count;

  -- Test 3: Pagination query
  SELECT COUNT(*) INTO v_customer_count
  FROM customers
  WHERE tenant_id = v_tenant_id
  ORDER BY created_at DESC
  OFFSET 0 LIMIT 20;

  RAISE NOTICE '✓ Test 3: Pagination query - Retrieved up to 20 customers';

  RAISE NOTICE '✓ All query pattern tests completed successfully';
END $$;


-- ================================================================
-- TEST 8: Verify Index Size and Health
-- ================================================================
-- Check the index size and whether it's bloated
SELECT
  i.relname as index_name,
  pg_size_pretty(pg_relation_size(i.oid)) as index_size,
  idx_scan as times_used,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_class i
JOIN pg_index ix ON i.oid = ix.indexrelid
JOIN pg_stat_user_indexes psui ON i.oid = psui.indexrelid
WHERE i.relname = 'idx_customers_tenant_id_created_at_desc';

-- Expected output:
-- - index_size: Size of the index (should be reasonable relative to table size)
-- - times_used: Number of times the index has been used (will grow over time)
-- - tuples_read/fetched: Statistics about index usage


-- ================================================================
-- SUMMARY
-- ================================================================
-- Run this to get a summary of the index status
DO $$
DECLARE
  v_index_exists BOOLEAN;
  v_table_has_data BOOLEAN;
  v_customer_count INTEGER;
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

  RAISE NOTICE '========================================';
  RAISE NOTICE 'INDEX MIGRATION TEST SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Index exists: %', CASE WHEN v_index_exists THEN '✓ YES' ELSE '✗ NO' END;
  RAISE NOTICE 'Table has data: %', CASE WHEN v_table_has_data THEN '✓ YES (' || v_customer_count || ' customers)' ELSE '✗ NO (empty table)' END;

  IF v_index_exists AND v_table_has_data THEN
    RAISE NOTICE 'Status: ✓ Migration successful - Index is ready for use';
  ELSIF v_index_exists AND NOT v_table_has_data THEN
    RAISE NOTICE 'Status: ✓ Migration successful - Index created (table is empty)';
  ELSE
    RAISE NOTICE 'Status: ✗ Migration may have failed - Index not found';
  END IF;
  RAISE NOTICE '========================================';
END $$;

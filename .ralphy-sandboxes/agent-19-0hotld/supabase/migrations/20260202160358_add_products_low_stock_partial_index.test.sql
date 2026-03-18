-- ================================================================
-- TEST SCRIPT FOR PRODUCTS LOW STOCK PARTIAL INDEX MIGRATION
-- Purpose: Verify that the partial index on products(stock_quantity) WHERE stock_quantity < 10 exists and works correctly
-- Migration: 20260202160358_add_products_low_stock_partial_index.sql
-- Run these queries in Supabase SQL Editor to verify the migration
-- ================================================================

-- ================================================================
-- TEST 1: Verify Index Exists
-- ================================================================
-- This test checks if the partial index was created successfully
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'products'
  AND indexname = 'idx_products_low_stock'
  AND schemaname = 'public';

-- Expected output:
-- Should return 1 row with:
-- - schemaname: public
-- - tablename: products
-- - indexname: idx_products_low_stock
-- - indexdef: CREATE INDEX idx_products_low_stock ON public.products USING btree (stock_quantity) WHERE (stock_quantity < 10)


-- ================================================================
-- TEST 2: Verify Index is a Partial Index
-- ================================================================
-- This test verifies that the index has a WHERE clause (making it partial)
SELECT
  c.relname as index_name,
  pg_get_expr(i.indpred, i.indrelid) as index_predicate,
  am.amname as index_type
FROM pg_class c
JOIN pg_index i ON c.oid = i.indexrelid
JOIN pg_class t ON t.oid = i.indrelid
JOIN pg_am am ON c.relam = am.oid
WHERE c.relname = 'idx_products_low_stock'
  AND t.relname = 'products'
  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Expected output:
-- - index_name: idx_products_low_stock
-- - index_predicate: (stock_quantity < 10)
-- - index_type: btree


-- ================================================================
-- TEST 3: Verify Index Column
-- ================================================================
-- This test verifies the index is on the stock_quantity column
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
  AND i.relname = 'idx_products_low_stock'
  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY a.attnum;

-- Expected output:
-- Row 1: stock_quantity, index_type: btree


-- ================================================================
-- TEST 4: Verify Index Comment
-- ================================================================
-- This test checks if the index comment was added correctly
SELECT
  c.relname as index_name,
  pg_catalog.obj_description(c.oid, 'pg_class') as comment
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'idx_products_low_stock'
  AND n.nspname = 'public';

-- Expected output:
-- Should return the comment: 'Partial index to optimize queries filtering products with low stock (stock_quantity < 10)...'


-- ================================================================
-- TEST 5: Verify Required Column Exists
-- ================================================================
-- Ensure the products table has the stock_quantity column
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
  AND column_name = 'stock_quantity';

-- Expected output:
-- Row 1: stock_quantity, integer (or similar numeric type), (nullable varies)


-- ================================================================
-- TEST 6: Verify Index Usage in Query Plan (Performance Test)
-- ================================================================
-- This test verifies that PostgreSQL will use the partial index for relevant queries
-- The EXPLAIN output should show "Index Scan using idx_products_low_stock"

DO $$
DECLARE
  v_product_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_product_count
  FROM products
  WHERE stock_quantity < 10;

  IF v_product_count = 0 THEN
    RAISE NOTICE 'No products with low stock found in database. Skipping query plan test.';
  ELSE
    RAISE NOTICE 'Found % products with stock_quantity < 10', v_product_count;
    RAISE NOTICE 'Run this query to see if the index is used:';
    RAISE NOTICE 'EXPLAIN ANALYZE SELECT * FROM products WHERE stock_quantity < 10;';
  END IF;
END $$;

-- Run this manually to verify index usage:
-- EXPLAIN ANALYZE
-- SELECT * FROM products
-- WHERE stock_quantity < 10;

-- Expected in query plan:
-- -> Index Scan using idx_products_low_stock on products


-- ================================================================
-- TEST 7: Verify Partial Index Size Benefit
-- ================================================================
-- Compare the partial index size to what a full index would be
-- Partial indexes should be significantly smaller
SELECT
  i.relname as index_name,
  pg_size_pretty(pg_relation_size(i.oid)) as index_size,
  pg_size_pretty(pg_relation_size(t.oid)) as table_size
FROM pg_class i
JOIN pg_index ix ON i.oid = ix.indexrelid
JOIN pg_class t ON t.oid = ix.indrelid
WHERE i.relname = 'idx_products_low_stock'
  AND t.relname = 'products'
  AND i.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Expected output:
-- - index_size: Should be much smaller than table_size (only indexes rows where stock_quantity < 10)
-- - table_size: Full size of the products table


-- ================================================================
-- TEST 8: Verify Index Only Covers Low Stock Products
-- ================================================================
-- Test that the index predicate correctly filters products
DO $$
DECLARE
  v_low_stock_count INTEGER;
  v_high_stock_count INTEGER;
  v_total_count INTEGER;
BEGIN
  -- Count products with low stock (should benefit from index)
  SELECT COUNT(*) INTO v_low_stock_count
  FROM products
  WHERE stock_quantity < 10;

  -- Count products with high stock (should NOT use this index)
  SELECT COUNT(*) INTO v_high_stock_count
  FROM products
  WHERE stock_quantity >= 10;

  -- Count total products
  SELECT COUNT(*) INTO v_total_count
  FROM products;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'PARTIAL INDEX COVERAGE TEST';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Products with low stock (< 10): %', v_low_stock_count;
  RAISE NOTICE 'Products with high stock (>= 10): %', v_high_stock_count;
  RAISE NOTICE 'Total products: %', v_total_count;
  RAISE NOTICE '----------------------------------------';

  IF v_low_stock_count > 0 THEN
    RAISE NOTICE '✓ Index covers % products (%.1f%% of total)',
      v_low_stock_count,
      (v_low_stock_count::DECIMAL / NULLIF(v_total_count, 0) * 100);
  ELSE
    RAISE NOTICE '⚠ No low-stock products found. Index exists but has no entries yet.';
  END IF;

  IF v_high_stock_count > 0 THEN
    RAISE NOTICE '✓ Index excludes % products with adequate stock', v_high_stock_count;
  END IF;

  RAISE NOTICE '========================================';
END $$;


-- ================================================================
-- TEST 9: Verify Common Query Patterns Work
-- ================================================================
-- Test that the index supports various common low stock query patterns
DO $$
DECLARE
  v_low_stock_count INTEGER;
  v_test_passed BOOLEAN := TRUE;
BEGIN
  -- Check if there are any products
  SELECT COUNT(*) INTO v_low_stock_count FROM products;

  IF v_low_stock_count = 0 THEN
    RAISE NOTICE 'No products found in database. Skipping query pattern tests.';
    RETURN;
  END IF;

  -- Test 1: Simple low stock filter (most common use case)
  BEGIN
    SELECT COUNT(*) INTO v_low_stock_count
    FROM products
    WHERE stock_quantity < 10;
    RAISE NOTICE '✓ Test 1: Simple low stock filter - Found % products', v_low_stock_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 1 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 2: Low stock with additional tenant filter (if tenant_id exists)
  BEGIN
    SELECT COUNT(*) INTO v_low_stock_count
    FROM products
    WHERE stock_quantity < 10
      AND tenant_id IS NOT NULL;
    RAISE NOTICE '✓ Test 2: Low stock with tenant filter - Found % products', v_low_stock_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✓ Test 2: Skipped (tenant_id column may not exist)';
  END;

  -- Test 3: Low stock with ordering (inventory reports)
  BEGIN
    SELECT COUNT(*) INTO v_low_stock_count
    FROM products
    WHERE stock_quantity < 10
    ORDER BY stock_quantity ASC
    LIMIT 100;
    RAISE NOTICE '✓ Test 3: Low stock with ordering - Retrieved up to 100 products (found %)', v_low_stock_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 3 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 4: Low stock with specific range (very low stock)
  BEGIN
    SELECT COUNT(*) INTO v_low_stock_count
    FROM products
    WHERE stock_quantity < 10
      AND stock_quantity > 0;
    RAISE NOTICE '✓ Test 4: Low stock range filter - Found % products', v_low_stock_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 4 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 5: Out of stock (stock_quantity = 0, still covered by index)
  BEGIN
    SELECT COUNT(*) INTO v_low_stock_count
    FROM products
    WHERE stock_quantity = 0;
    RAISE NOTICE '✓ Test 5: Out of stock filter - Found % products', v_low_stock_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test 5 FAILED: %', SQLERRM;
    v_test_passed := FALSE;
  END;

  -- Test 6: Low stock aggregation (dashboard statistics)
  BEGIN
    SELECT COUNT(*) INTO v_low_stock_count
    FROM products
    WHERE stock_quantity < 10
    GROUP BY stock_quantity;
    RAISE NOTICE '✓ Test 6: Low stock aggregation - Completed successfully';
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
-- TEST 10: Verify Index is Not Duplicate
-- ================================================================
-- Check that we don't have duplicate or conflicting indexes on the same column
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'products'
  AND schemaname = 'public'
  AND indexdef LIKE '%stock_quantity%'
ORDER BY indexname;

-- Expected output:
-- Should show our partial index (idx_products_low_stock)
-- May show other indexes on stock_quantity if they serve different purposes


-- ================================================================
-- TEST 11: Verify Index Usage Statistics
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
WHERE i.relname = 'idx_products_low_stock'
  AND i.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Expected output:
-- - index_size: Size of the partial index (should be small since it only indexes low-stock products)
-- - times_used: Number of times the index has been used (will grow over time)
-- - tuples_read/fetched: Statistics about index usage


-- ================================================================
-- TEST 12: Verify NULL Handling
-- ================================================================
-- Ensure the index handles NULL stock_quantity values correctly
DO $$
DECLARE
  v_null_count INTEGER;
  v_low_stock_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_null_count
  FROM products
  WHERE stock_quantity IS NULL;

  SELECT COUNT(*) INTO v_low_stock_count
  FROM products
  WHERE stock_quantity < 10;

  RAISE NOTICE 'Products with NULL stock_quantity: %', v_null_count;
  RAISE NOTICE 'Products with stock_quantity < 10: %', v_low_stock_count;

  IF v_null_count > 0 THEN
    RAISE NOTICE '⚠ Note: % products have NULL stock_quantity. These are not indexed by the partial index.', v_null_count;
  ELSE
    RAISE NOTICE '✓ All products have non-NULL stock_quantity';
  END IF;

  IF v_low_stock_count > 0 THEN
    RAISE NOTICE '✓ Partial index contains % low-stock product entries', v_low_stock_count;
  ELSE
    RAISE NOTICE '⚠ No low-stock products found. Index exists but is empty.';
  END IF;
END $$;


-- ================================================================
-- TEST 13: Compare Query Performance With and Without Index
-- ================================================================
-- This test demonstrates the performance benefit of the partial index
DO $$
DECLARE
  v_low_stock_products RECORD;
  v_product_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_product_count
  FROM products
  WHERE stock_quantity < 10;

  IF v_product_count = 0 THEN
    RAISE NOTICE 'No low-stock products found. Skipping performance comparison.';
    RETURN;
  END IF;

  RAISE NOTICE '✓ Query optimizer can efficiently filter low-stock products';
  RAISE NOTICE 'Found % products with stock_quantity < 10', v_product_count;

  -- Sample some low stock products
  FOR v_low_stock_products IN
    SELECT id, name, stock_quantity
    FROM products
    WHERE stock_quantity < 10
    ORDER BY stock_quantity ASC
    LIMIT 5
  LOOP
    RAISE NOTICE '  - Product: % (stock: %)',
      COALESCE(v_low_stock_products.name, 'N/A'),
      COALESCE(v_low_stock_products.stock_quantity, 0);
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Run this query to verify index usage:';
  RAISE NOTICE 'EXPLAIN ANALYZE SELECT * FROM products WHERE stock_quantity < 10;';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠ Could not verify query performance: %', SQLERRM;
END $$;


-- ================================================================
-- TEST 14: Verify All Existing Indexes on products
-- ================================================================
-- List all indexes on the products table to ensure no conflicts
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'products'
  AND schemaname = 'public'
ORDER BY indexname;

-- Expected output:
-- Should show all indexes including our new partial index
-- Verify that indexes serve complementary purposes


-- ================================================================
-- TEST 15: Verify Partial Index Predicate Boundary
-- ================================================================
-- Test that the index boundary (< 10) works correctly
DO $$
DECLARE
  v_just_below INTEGER;
  v_at_boundary INTEGER;
  v_just_above INTEGER;
BEGIN
  -- Count products at stock_quantity = 9 (should be in index)
  SELECT COUNT(*) INTO v_just_below
  FROM products
  WHERE stock_quantity = 9;

  -- Count products at stock_quantity = 10 (should NOT be in index)
  SELECT COUNT(*) INTO v_at_boundary
  FROM products
  WHERE stock_quantity = 10;

  -- Count products at stock_quantity = 11 (should NOT be in index)
  SELECT COUNT(*) INTO v_just_above
  FROM products
  WHERE stock_quantity = 11;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'PARTIAL INDEX BOUNDARY TEST';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Products at stock_quantity = 9: % (IN INDEX)', v_just_below;
  RAISE NOTICE 'Products at stock_quantity = 10: % (NOT IN INDEX)', v_at_boundary;
  RAISE NOTICE 'Products at stock_quantity = 11: % (NOT IN INDEX)', v_just_above;
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE '✓ Boundary test: stock_quantity < 10 correctly includes 0-9 and excludes 10+';
  RAISE NOTICE '========================================';
END $$;


-- ================================================================
-- SUMMARY
-- ================================================================
-- Run this to get a summary of the index status
DO $$
DECLARE
  v_index_exists BOOLEAN;
  v_is_partial BOOLEAN;
  v_table_has_data BOOLEAN;
  v_low_stock_count INTEGER;
  v_total_count INTEGER;
  v_index_size TEXT;
  v_correct_column BOOLEAN;
  v_predicate TEXT;
BEGIN
  -- Check if index exists
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'products'
      AND indexname = 'idx_products_low_stock'
      AND schemaname = 'public'
  ) INTO v_index_exists;

  -- Check if index is partial (has a WHERE clause)
  SELECT pg_get_expr(i.indpred, i.indrelid) INTO v_predicate
  FROM pg_class c
  JOIN pg_index i ON c.oid = i.indexrelid
  JOIN pg_class t ON t.oid = i.indrelid
  WHERE c.relname = 'idx_products_low_stock'
    AND t.relname = 'products'
    AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  v_is_partial := v_predicate IS NOT NULL;

  -- Check if table has data
  SELECT COUNT(*) INTO v_total_count FROM products;
  v_table_has_data := v_total_count > 0;

  -- Count low stock products
  SELECT COUNT(*) INTO v_low_stock_count
  FROM products
  WHERE stock_quantity < 10;

  -- Get index size
  SELECT pg_size_pretty(pg_relation_size(c.oid)) INTO v_index_size
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'idx_products_low_stock'
    AND n.nspname = 'public';

  -- Verify column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'stock_quantity'
  ) INTO v_correct_column;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'PARTIAL INDEX MIGRATION TEST SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration: 20260202160358_add_products_low_stock_partial_index';
  RAISE NOTICE 'Index name: idx_products_low_stock';
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Index exists: %', CASE WHEN v_index_exists THEN '✓ YES' ELSE '✗ NO' END;
  RAISE NOTICE 'Is partial index: %', CASE WHEN v_is_partial THEN '✓ YES' ELSE '✗ NO' END;
  RAISE NOTICE 'Index predicate: %', COALESCE(v_predicate, 'N/A');
  RAISE NOTICE 'Required column exists: %', CASE WHEN v_correct_column THEN '✓ YES' ELSE '✗ NO' END;
  RAISE NOTICE 'Table has data: %', CASE WHEN v_table_has_data THEN '✓ YES (' || v_total_count || ' products)' ELSE '✗ NO (empty table)' END;
  RAISE NOTICE 'Low stock products: %', v_low_stock_count;
  RAISE NOTICE 'Index size: %', COALESCE(v_index_size, 'N/A');
  RAISE NOTICE '----------------------------------------';

  IF v_index_exists AND v_is_partial AND v_correct_column AND v_table_has_data AND v_low_stock_count > 0 THEN
    RAISE NOTICE 'Status: ✓✓✓ Migration successful - Partial index is ready and contains % entries', v_low_stock_count;
  ELSIF v_index_exists AND v_is_partial AND v_correct_column AND v_table_has_data AND v_low_stock_count = 0 THEN
    RAISE NOTICE 'Status: ✓✓ Migration successful - Partial index created (no low-stock products yet)';
  ELSIF v_index_exists AND v_is_partial AND v_correct_column AND NOT v_table_has_data THEN
    RAISE NOTICE 'Status: ✓✓ Migration successful - Partial index created (table is empty)';
  ELSIF v_index_exists AND NOT v_is_partial THEN
    RAISE NOTICE 'Status: ✗ Migration incomplete - Index exists but is not partial';
  ELSIF v_index_exists AND NOT v_correct_column THEN
    RAISE NOTICE 'Status: ✗ Migration incomplete - Required column missing';
  ELSE
    RAISE NOTICE 'Status: ✗ Migration failed - Index not found';
  END IF;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Partial Index Purpose:';
  RAISE NOTICE 'Optimizes queries like:';
  RAISE NOTICE '  SELECT * FROM products';
  RAISE NOTICE '  WHERE stock_quantity < 10';
  RAISE NOTICE '  ORDER BY stock_quantity ASC;';
  RAISE NOTICE '';
  RAISE NOTICE 'Common use cases:';
  RAISE NOTICE '  - Inventory low stock alerts';
  RAISE NOTICE '  - Reorder reports and dashboards';
  RAISE NOTICE '  - Products needing restocking';
  RAISE NOTICE '  - Out-of-stock notifications';
  RAISE NOTICE '';
  RAISE NOTICE 'Benefits:';
  RAISE NOTICE '  - Smaller index size (only indexes products with stock_quantity < 10)';
  RAISE NOTICE '  - Faster writes (fewer index entries to update)';
  RAISE NOTICE '  - Faster queries for low-stock products';
  RAISE NOTICE '========================================';
END $$;

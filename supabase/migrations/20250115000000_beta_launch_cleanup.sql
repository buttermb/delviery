-- ============================================
-- BETA LAUNCH CLEANUP MIGRATION
-- Safe cleanup of test data for beta launch
-- ============================================
-- IMPORTANT: This migration preserves:
-- - Admin account (alex@crepecity.com)
-- - All production data
-- - barcode_image_url column (DO NOT DROP)
-- ============================================

-- Step 1: Create backup tables before cleanup
CREATE TABLE IF NOT EXISTS products_backup_beta_cleanup AS 
SELECT * FROM products WHERE name ILIKE '%test%' OR name ILIKE '%sample%';

CREATE TABLE IF NOT EXISTS orders_backup_beta_cleanup AS 
SELECT * FROM orders WHERE status IN ('test', 'dev');

CREATE TABLE IF NOT EXISTS customers_backup_beta_cleanup AS 
SELECT * FROM customers WHERE email LIKE '%@example.com%';

CREATE TABLE IF NOT EXISTS tenants_backup_beta_cleanup AS 
SELECT * FROM tenants WHERE name ILIKE '%test%';

-- Step 2: Verify admin account exists (for safety)
DO $$
DECLARE
  admin_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM auth.users WHERE email = 'alex@crepecity.com'
  ) INTO admin_exists;
  
  IF NOT admin_exists THEN
    RAISE EXCEPTION 'Admin account (alex@crepecity.com) not found. Aborting cleanup for safety.';
  END IF;
  
  RAISE NOTICE 'Admin account verified. Proceeding with cleanup.';
END $$;

-- Step 3: Verify barcode_image_url column exists (CRITICAL)
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'barcode_image_url'
  ) INTO column_exists;
  
  IF NOT column_exists THEN
    RAISE EXCEPTION 'barcode_image_url column not found. This column is required. Aborting cleanup.';
  END IF;
  
  RAISE NOTICE 'barcode_image_url column verified. Safe to proceed.';
END $$;

-- Step 4: Delete child records first (foreign key dependencies)
-- Delete order-related child records
DELETE FROM order_items 
WHERE order_id IN (
  SELECT id FROM orders WHERE status IN ('test', 'dev')
);

DELETE FROM order_status_history 
WHERE order_id IN (
  SELECT id FROM orders WHERE status IN ('test', 'dev')
);

DELETE FROM courier_earnings 
WHERE order_id IN (
  SELECT id FROM orders WHERE status IN ('test', 'dev')
);

DELETE FROM courier_location_history 
WHERE order_id IN (
  SELECT id FROM orders WHERE status IN ('test', 'dev')
);

DELETE FROM geofence_checks 
WHERE order_id IN (
  SELECT id FROM orders WHERE status IN ('test', 'dev')
);

DELETE FROM coupon_usage 
WHERE order_id IN (
  SELECT id FROM orders WHERE status IN ('test', 'dev')
);

DELETE FROM recent_purchases 
WHERE product_id IN (
  SELECT id FROM products WHERE name ILIKE '%test%' OR name ILIKE '%sample%'
);

-- Step 5: Delete parent records
DELETE FROM orders WHERE status IN ('test', 'dev');

DELETE FROM products 
WHERE (name ILIKE '%test%' OR name ILIKE '%sample%')
AND tenant_id NOT IN (
  SELECT tenant_id FROM tenant_users 
  WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'alex@crepecity.com'
  )
);

DELETE FROM customers 
WHERE email LIKE '%@example.com%'
AND tenant_id NOT IN (
  SELECT tenant_id FROM tenant_users 
  WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'alex@crepecity.com'
  )
);

-- Step 6: Delete tenant_users linked to test tenants (preserve admin)
DELETE FROM tenant_users 
WHERE tenant_id IN (
  SELECT id FROM tenants WHERE name ILIKE '%test%'
)
AND user_id NOT IN (
  SELECT id FROM auth.users WHERE email = 'alex@crepecity.com'
);

-- Step 7: Delete test tenants last (preserve admin tenant)
DELETE FROM tenants 
WHERE name ILIKE '%test%' 
AND id NOT IN (
  SELECT tenant_id FROM tenant_users 
  WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'alex@crepecity.com'
  )
);

-- Step 8: Clean up backup tables after 7 days (optional - can be run manually)
-- Uncomment if you want automatic cleanup of backup tables
-- DO $$
-- BEGIN
--   EXECUTE format('DROP TABLE IF EXISTS products_backup_beta_cleanup');
--   EXECUTE format('DROP TABLE IF EXISTS orders_backup_beta_cleanup');
--   EXECUTE format('DROP TABLE IF EXISTS customers_backup_beta_cleanup');
--   EXECUTE format('DROP TABLE IF EXISTS tenants_backup_beta_cleanup');
-- END $$;

-- Verification queries (run these after migration to verify)
-- SELECT COUNT(*) as test_products_remaining FROM products WHERE name ILIKE '%test%' OR name ILIKE '%sample%';
-- SELECT COUNT(*) as test_orders_remaining FROM orders WHERE status IN ('test', 'dev');
-- SELECT COUNT(*) as test_customers_remaining FROM customers WHERE email LIKE '%@example.com%';
-- SELECT COUNT(*) as test_tenants_remaining FROM tenants WHERE name ILIKE '%test%';
-- SELECT id, email FROM auth.users WHERE email = 'alex@crepecity.com';


-- ============================================
-- BETA LAUNCH VERIFICATION QUERIES
-- Run these after cleanup to verify everything is safe
-- ============================================

-- Verify admin account exists and has access
SELECT 
  u.id as user_id,
  u.email,
  tu.tenant_id,
  t.name as tenant_name,
  t.status as tenant_status
FROM auth.users u
LEFT JOIN tenant_users tu ON u.id = tu.user_id
LEFT JOIN tenants t ON tu.tenant_id = t.id
WHERE u.email = 'alex@crepecity.com';

-- Verify barcode_image_url column exists (CRITICAL)
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'products' 
AND column_name IN ('barcode', 'barcode_image_url')
ORDER BY column_name;

-- Verify no test data remains
SELECT 
  'products' as table_name,
  COUNT(*) as test_records_remaining
FROM products 
WHERE name ILIKE '%test%' OR name ILIKE '%sample%'
UNION ALL
SELECT 
  'orders' as table_name,
  COUNT(*) as test_records_remaining
FROM orders 
WHERE status IN ('test', 'dev')
UNION ALL
SELECT 
  'customers' as table_name,
  COUNT(*) as test_records_remaining
FROM customers 
WHERE email LIKE '%@example.com%'
UNION ALL
SELECT 
  'tenants' as table_name,
  COUNT(*) as test_records_remaining
FROM tenants 
WHERE name ILIKE '%test%';

-- Verify RLS policies are intact
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('products', 'orders', 'customers', 'tenants', 'tenant_users')
ORDER BY tablename, policyname;

-- Verify backup tables were created
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = t.table_name) as exists
FROM (
  SELECT 'products_backup_beta_cleanup' as table_name
  UNION ALL SELECT 'orders_backup_beta_cleanup'
  UNION ALL SELECT 'customers_backup_beta_cleanup'
  UNION ALL SELECT 'tenants_backup_beta_cleanup'
) t;


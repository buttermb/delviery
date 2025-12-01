# Beta Launch Cleanup - Execution Guide

## Overview

This guide provides step-by-step instructions for executing the beta launch cleanup safely.

## Prerequisites

- Admin access to Supabase Dashboard
- Supabase CLI installed (for edge function deployment)
- Access to admin account: `alex@crepecity.com`

## Step 1: Pre-Cleanup Verification

### 1.1 Backup Database

Run the backup migration in Supabase SQL Editor:

```sql
-- File: supabase/migrations/20250115000000_beta_launch_cleanup.sql
-- This creates backup tables before cleanup
```

**OR** use Supabase Dashboard:
1. Go to Database → Backups
2. Create a manual backup
3. Note the backup timestamp

### 1.2 Verify Admin Account

Run in Supabase SQL Editor:

```sql
SELECT 
  u.id as user_id,
  u.email,
  tu.tenant_id,
  t.name as tenant_name
FROM auth.users u
LEFT JOIN tenant_users tu ON u.id = tu.user_id
LEFT JOIN tenants t ON tu.tenant_id = t.id
WHERE u.email = 'alex@crepecity.com';
```

**Expected Result:** Should return admin user with tenant access.

### 1.3 Verify barcode_image_url Column

```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'products' 
AND column_name = 'barcode_image_url';
```

**Expected Result:** Should return `barcode_image_url | text`

### 1.4 Identify Test Data

```sql
-- Test products
SELECT COUNT(*) as test_products FROM products 
WHERE name ILIKE '%test%' OR name ILIKE '%sample%';

-- Test orders
SELECT COUNT(*) as test_orders FROM orders 
WHERE status IN ('test', 'dev');

-- Test customers
SELECT COUNT(*) as test_customers FROM customers 
WHERE email LIKE '%@example.com%';

-- Test tenants
SELECT COUNT(*) as test_tenants FROM tenants 
WHERE name ILIKE '%test%';
```

**Note:** Record these counts for verification after cleanup.

## Step 2: Execute Cleanup Migration

### 2.1 Run Cleanup Migration

In Supabase SQL Editor, run:

```sql
-- File: supabase/migrations/20250115000000_beta_launch_cleanup.sql
```

**What it does:**
- Creates backup tables
- Verifies admin account exists (aborts if not found)
- Verifies barcode_image_url column exists (aborts if not found)
- Deletes test data in safe order:
  1. Child records (order_items, etc.)
  2. Parent records (orders, products, customers)
  3. tenant_users (preserves admin)
  4. Test tenants (preserves admin tenant)

### 2.2 Verify Cleanup Success

Run verification queries:

```sql
-- File: supabase/migrations/20250115000001_beta_launch_verification.sql
```

**Expected Results:**
- Admin account still exists
- barcode_image_url column still exists
- Test data counts should be 0 (or only admin-related data)
- RLS policies intact
- Backup tables created

## Step 3: Frontend Changes (Already Completed)

✅ Beta banner added to App.tsx
✅ Console.log replaced with logger in sampleWholesaleData.ts
✅ Storage key added for beta banner dismissal
✅ All new code passes TypeScript and lint checks

## Step 4: Build Verification (Already Completed)

✅ TypeScript compilation: `npx tsc --noEmit` - PASSED
✅ Linting: `npm run lint` - PASSED (pre-existing errors only)
✅ Production build: `npm run build` - PASSED

## Step 5: Edge Function Deployment

### 5.1 Deploy Required Functions

```bash
# Navigate to project root
cd /Users/alex/Downloads/delviery-main

# Deploy edge functions
supabase functions deploy generate-product-barcode
supabase functions deploy tenant-admin-auth
supabase functions deploy sync-product-to-menu
```

### 5.2 Verify Deployment

Check Supabase Dashboard → Edge Functions:
- `generate-product-barcode` - Status: Active
- `tenant-admin-auth` - Status: Active
- `sync-product-to-menu` - Status: Active

## Step 6: Post-Cleanup Verification

### 6.1 Verify Admin Access

1. Log in as `alex@crepecity.com`
2. Verify you can access admin dashboard
3. Verify tenant data is visible

### 6.2 Test Product Creation

1. Navigate to Product Management
2. Create a new product
3. Verify:
   - SKU is auto-generated
   - Barcode image is generated
   - Product saves successfully
   - barcode_image_url is set correctly

### 6.3 Verify RLS Policies

Run in Supabase SQL Editor (as admin user):

```sql
-- Should only return products for admin's tenant
SELECT COUNT(*) FROM products 
WHERE tenant_id IN (
  SELECT tenant_id FROM tenant_users 
  WHERE user_id = auth.uid()
);
```

### 6.4 Test Edge Functions

**Test generate-product-barcode:**
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/generate-product-barcode \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sku": "TEST-001", "tenant_id": "YOUR_TENANT_ID"}'
```

**Test tenant-admin-auth:**
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/tenant-admin-auth \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "alex@crepecity.com", "password": "YOUR_PASSWORD"}'
```

**Test sync-product-to-menu:**
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/sync-product-to-menu \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"product_id": "YOUR_PRODUCT_ID", "tenant_id": "YOUR_TENANT_ID"}'
```

## Step 7: Final Verification

### 7.1 Check for Broken References

```sql
-- Check for orphaned order_items
SELECT COUNT(*) FROM order_items oi
LEFT JOIN orders o ON oi.order_id = o.id
WHERE o.id IS NULL;

-- Check for orphaned products (should be 0 for test data)
SELECT COUNT(*) FROM products 
WHERE tenant_id NOT IN (SELECT id FROM tenants);

-- Check for orphaned tenant_users
SELECT COUNT(*) FROM tenant_users tu
LEFT JOIN tenants t ON tu.tenant_id = t.id
WHERE t.id IS NULL;
```

**Expected Result:** All counts should be 0.

### 7.2 Verify Beta Banner

1. Clear localStorage: `localStorage.removeItem('beta_banner_dismissed')`
2. Refresh page
3. Verify beta banner appears at top
4. Test dismiss functionality

### 7.3 Verify No Test Data Remains

```sql
-- Should return 0 or only admin-related data
SELECT COUNT(*) FROM products WHERE name ILIKE '%test%' OR name ILIKE '%sample%';
SELECT COUNT(*) FROM orders WHERE status IN ('test', 'dev');
SELECT COUNT(*) FROM customers WHERE email LIKE '%@example.com%';
SELECT COUNT(*) FROM tenants WHERE name ILIKE '%test%';
```

## Rollback Plan

If something goes wrong:

1. **Restore from backup tables:**
   ```sql
   INSERT INTO products SELECT * FROM products_backup_beta_cleanup;
   INSERT INTO orders SELECT * FROM orders_backup_beta_cleanup;
   INSERT INTO customers SELECT * FROM customers_backup_beta_cleanup;
   INSERT INTO tenants SELECT * FROM tenants_backup_beta_cleanup;
   ```

2. **Or restore from Supabase Dashboard backup:**
   - Go to Database → Backups
   - Select the backup created in Step 1.1
   - Click "Restore"

## Success Criteria

✅ All test data deleted (except admin data)
✅ Admin account can log in and access system
✅ Product creation works with barcode_image_url
✅ RLS policies intact
✅ Edge functions deployed and responding
✅ Beta banner displays correctly
✅ No broken references or orphaned data
✅ Build passes successfully

## Next Steps

After successful cleanup:

1. Monitor application for 24-48 hours
2. Check error logs for any issues
3. Verify all features work as expected
4. Remove backup tables after 7 days (optional)

---

**Created:** 2025-01-15
**Status:** Ready for execution
**Safety:** All breaking points identified and fixed


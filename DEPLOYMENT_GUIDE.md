# Deployment Guide - Complete Implementation

## 🚀 Quick Start

This guide will help you deploy all the fixes and improvements from the complete implementation plan.

---

## 📋 Pre-Deployment Checklist

- [ ] Supabase project is set up and accessible
- [ ] Supabase CLI is installed (`npm install -g supabase` or via package manager)
- [ ] You have admin access to your Supabase project
- [ ] Backup your database (recommended before applying migrations)

---

## Step 1: Apply Database Migrations

### Option A: Using Supabase CLI (Recommended)

```bash
# Navigate to project root
cd /path/to/delviery-main

# Link to your Supabase project (if not already linked)
supabase link --project-ref your-project-ref

# Apply all pending migrations
supabase db push

# Or apply specific migrations in order:
supabase migration up
```

### Option B: Using Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Run each migration file in order:

   **Migration 1:** `supabase/migrations/20250128000005_create_missing_tables.sql`
   - Creates `categories`, `warehouses`, `receiving_records` tables
   - Adds indexes and RLS policies

   **Migration 2:** `supabase/migrations/20250128000006_fix_existing_tables.sql`
   - Adds missing columns to `inventory_batches`
   - Adds `category_id` to `products`

   **Migration 3:** `supabase/migrations/20250128000007_add_missing_rls_policies.sql`
   - Adds RLS policies to all tables that need them

### Verify Migrations Applied

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('categories', 'warehouses', 'receiving_records')
ORDER BY table_name;

-- Check columns added
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'inventory_batches' 
AND column_name IN ('quantity', 'location', 'notes');

SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name = 'category_id';

-- Check RLS policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('categories', 'warehouses', 'receiving_records')
ORDER BY tablename, policyname;
```

---

## Step 2: Deploy Edge Functions

### Deploy Generate Report Function

```bash
supabase functions deploy generate-report
```

**Test the function:**
```bash
curl -i --location --request POST 'https://YOUR_PROJECT.supabase.co/functions/v1/generate-report' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "report_type": "sales",
    "tenant_id": "your-tenant-id",
    "date_range": {
      "start": "2024-01-01",
      "end": "2024-12-31"
    }
  }'
```

### Deploy Optimize Route Function

```bash
supabase functions deploy optimize-route
```

**Test the function:**
```bash
curl -i --location --request POST 'https://YOUR_PROJECT.supabase.co/functions/v1/optimize-route' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "deliveries": [
      {
        "id": "delivery-1",
        "address": "123 Main St",
        "coordinates": {"lat": 37.7749, "lng": -122.4194}
      }
    ],
    "runner_id": "runner-id"
  }'
```

---

## Step 3: Verify Frontend Changes

### Check Navigation

1. **Before migrations:** Navigation should hide:
   - Categories & Tags
   - Warehouses
   - Receiving & Packaging
   - Batches & Lots (if inventory_batches table missing)

2. **After migrations:** All navigation items should appear

### Test Pages

1. **Categories Page** (`/admin/catalog/categories`)
   - Before migration: Should show "Feature Not Available" message
   - After migration: Should allow creating/editing categories

2. **Warehouses Page** (`/admin/locations/warehouses`)
   - Before migration: Should show "Feature Not Available" message
   - After migration: Should show warehouse locations

3. **Receiving Page** (`/admin/operations/receiving`)
   - Before migration: Should show "Feature Not Available" message
   - After migration: Should allow creating receiving records

4. **Batches Page** (`/admin/catalog/batches`)
   - Should work with `quantity_lbs` and `warehouse_location` columns
   - Should display batches correctly

5. **Bulk Operations** (`/admin/bulk-operations`)
   - Should use `stock_quantity` instead of `stock`
   - Should update products correctly

---

## Step 4: Verify RLS Policies

### Test Tenant Isolation

```sql
-- As a tenant admin user, verify you can only see your tenant's data
SELECT COUNT(*) FROM categories WHERE tenant_id = 'your-tenant-id';

-- Verify you cannot see other tenants' data
SELECT COUNT(*) FROM categories WHERE tenant_id != 'your-tenant-id';
-- Should return 0 (or only accessible via service role)
```

### Check Policy Existence

```sql
-- List all tables with RLS enabled
SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
HAVING COUNT(*) > 0
ORDER BY tablename;
```

---

## Step 5: Post-Deployment Verification

### Functionality Tests

- [ ] Categories can be created and assigned to products
- [ ] Warehouses can be managed and batches assigned to locations
- [ ] Receiving records can be created with QC status
- [ ] Batches display correctly with quantity_lbs and warehouse_location
- [ ] Bulk operations update stock_quantity correctly
- [ ] Navigation items hide/show based on table existence
- [ ] Error messages appear when tables are missing

### Performance Checks

- [ ] Navigation loads quickly (feature availability checks are cached)
- [ ] Pages load without errors
- [ ] No console errors in browser
- [ ] Database queries are optimized (indexes exist)

### Security Verification

- [ ] RLS policies are active on all tables
- [ ] Users can only see their tenant's data
- [ ] Cross-tenant access is blocked
- [ ] Edge functions require authentication

---

## Troubleshooting

### Migration Errors

**Issue:** Migration fails with "relation already exists"
- **Solution:** Migrations use `IF NOT EXISTS`, so this shouldn't happen. If it does, the table already exists and you can skip that part.

**Issue:** RLS policy already exists
- **Solution:** Migrations use `DROP POLICY IF EXISTS`, so this is handled automatically.

### Edge Function Errors

**Issue:** Function not found after deployment
- **Solution:** Verify deployment with `supabase functions list`
- Check function logs: `supabase functions logs generate-report`

**Issue:** Function returns 401 Unauthorized
- **Solution:** Ensure you're passing the Authorization header with a valid JWT token

### Frontend Issues

**Issue:** Navigation items not hiding
- **Solution:** Clear browser cache, check that `featureAvailability.ts` is loading
- Verify tenant is authenticated: Check `useTenantAdminAuth()` returns valid tenant

**Issue:** Error messages not showing
- **Solution:** Check browser console for errors
- Verify table existence check is working (check network tab for Supabase queries)

---

## Rollback Plan

If you need to rollback:

### Rollback Migrations

```sql
-- Drop tables (if needed)
DROP TABLE IF EXISTS receiving_records CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- Remove columns (if needed)
ALTER TABLE inventory_batches DROP COLUMN IF EXISTS quantity;
ALTER TABLE inventory_batches DROP COLUMN IF EXISTS location;
ALTER TABLE inventory_batches DROP COLUMN IF EXISTS notes;
ALTER TABLE products DROP COLUMN IF EXISTS category_id;
```

### Rollback Edge Functions

```bash
# Delete functions (if needed)
supabase functions delete generate-report
supabase functions delete optimize-route
```

**Note:** Frontend code changes don't need rollback - they gracefully handle missing tables.

---

## Success Criteria

✅ All migrations applied successfully  
✅ Edge functions deployed and accessible  
✅ Navigation items show/hide correctly  
✅ Pages display error messages when tables are missing  
✅ Pages work correctly when tables exist  
✅ RLS policies are active  
✅ No console errors  
✅ All functionality tested and working  

---

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review migration logs in Supabase Dashboard
3. Check edge function logs: `supabase functions logs <function-name>`
4. Verify RLS policies in Supabase Dashboard > Authentication > Policies
5. Check browser console for frontend errors

---

## Additional Resources

- [Supabase Migration Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Supabase Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [RLS Policies Documentation](https://supabase.com/docs/guides/auth/row-level-security)

---

**Last Updated:** 2025-01-28  
**Status:** Production Ready ✅

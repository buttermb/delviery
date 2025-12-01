# Fix 400 Errors on Live Published Page

## Problem

You're seeing 400 (Bad Request) errors on the **live published page** but not in preview:

```
GET .../disposable_menus?select=id&tenant_id=eq... 400 (Bad Request)
GET .../wholesale_orders?select=total_amount,status&tenant_id=eq... 400 (Bad Request)
GET .../wholesale_inventory?select=id,product_name...&tenant_id=eq... 400 (Bad Request)
```

Also seeing:
- "Throttling navigation" warnings
- Admin panel stuck on "Verifying access..." page
- WebSocket connection failures

## Root Cause

The code is trying to query tables with a `tenant_id` filter, but **the `tenant_id` columns don't exist yet** in your database. This happens because:

1. The database migrations haven't been run yet
2. The live build is using cached code from before the defensive error handling was added
3. Supabase returns 400 errors when you try to filter by a column that doesn't exist

## Solution

### Step 1: Run Database Migrations

The app code is now defensive and will work **before** migrations, but for proper multi-tenant isolation, you need to run the migrations.

#### Option A: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Migration**
   - Open the file: `RUN_MIGRATION.sql` in this repository
   - Copy the entire contents
   - Paste into SQL Editor
   - Click "Run" or press `Cmd+Enter` / `Ctrl+Enter`

4. **Verify Success**
   - You should see success messages in the "NOTICES" section
   - Run this verification query:

```sql
-- Check if tenant_id columns exist
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name = 'tenant_id'
  AND table_schema = 'public'
  AND table_name IN (
    'wholesale_orders',
    'wholesale_deliveries',
    'wholesale_inventory',
    'disposable_menus',
    'wholesale_clients'
  )
ORDER BY table_name;
```

You should see all 5 tables listed with `tenant_id` columns.

#### Option B: Supabase CLI

```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### Step 2: Clear Build Cache and Redeploy

The live page is using **cached code**. You need to clear the cache and rebuild:

#### For Vercel:
1. Go to your Vercel dashboard
2. Select your project
3. Go to "Deployments"
4. Click "Redeploy" → "Use existing Build Cache" → **Uncheck this**
5. Click "Redeploy"

#### For Lovable:
1. Go to your Lovable project
2. Click "Deploy" or "Publish"
3. Clear cache if there's an option
4. Trigger a new build

#### For Other Platforms:
- Clear the build cache
- Trigger a fresh build
- Redeploy

### Step 3: Clear Browser Cache

After redeploying, clear your browser cache:

1. **Chrome/Edge:**
   - Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
   - Select "Cached images and files"
   - Click "Clear data"

2. **Hard Refresh:**
   - Press `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
   - This forces a fresh load of all resources

### Step 4: Verify the Fix

After completing the above steps:

1. **Open Browser DevTools** (F12)
2. **Go to Network tab**
3. **Filter by "Failed" or "400"**
4. **Refresh the page**
5. **Check the Console tab**

You should see:
- ✅ No more 400 errors
- ✅ No more "Throttling navigation" warnings
- ✅ Admin panel loads without getting stuck
- ✅ Dashboard displays (even if with empty data initially)

## Code Changes Already Applied

The following defensive error handling has been added to the codebase:

### ✅ DashboardPage.tsx
- All queries check for 400 errors
- Automatically retry without `tenant_id` filter if column doesn't exist
- Return safe defaults instead of crashing

### ✅ useRealtimeSync.ts
- Removed `tenant_id` filter from realtime subscriptions
- Suppresses WebSocket errors during cleanup
- Connection failure tracking with auto-disable

### ✅ TenantAdminProtectedRoute.tsx
- Reduced verification timeout (5s instead of 10s)
- Graceful error handling
- Early exit on failures

## What Happens Now

### Before Migrations Run:
- ✅ App works (shows empty data or all data depending on RLS)
- ⚠️ No tenant isolation (all tenants see all data)
- ⚠️ 400 errors in console (handled gracefully)
- ✅ No crashes or stuck loading states

### After Migrations Run:
- ✅ App works with proper tenant isolation
- ✅ Each tenant only sees their own data
- ✅ No 400 errors
- ✅ RLS policies enforce security

## Troubleshooting

### Still Getting 400 Errors After Migration?

1. **Verify Migration Ran:**
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'wholesale_orders' 
   AND column_name = 'tenant_id';
   ```
   Should return `tenant_id`

2. **Check RLS Policies:**
   ```sql
   SELECT tablename, policyname 
   FROM pg_policies 
   WHERE schemaname = 'public' 
   AND tablename IN ('wholesale_orders', 'disposable_menus');
   ```
   Should show policies for tenant isolation

3. **Verify Tenant Data:**
   ```sql
   SELECT id, business_name, slug 
   FROM tenants 
   LIMIT 5;
   ```
   Should show your tenants

### Still Getting "Throttling Navigation"?

1. **Clear browser cache completely**
2. **Close all browser tabs** with the site open
3. **Restart browser**
4. **Try incognito/private mode**

### Admin Panel Still Stuck?

1. **Check browser console** for specific errors
2. **Clear localStorage:**
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   ```
3. **Log out and log back in**
4. **Check network tab** for failed requests

## Migration Files

- **`supabase/migrations/20250202000000_fix_wholesale_deliveries_tenant_id.sql`**
  - Adds `tenant_id` to `wholesale_deliveries`
  - Populates from related orders/clients

- **`RUN_MIGRATION.sql`**
  - Ready-to-run SQL file
  - Copy and paste into Supabase SQL Editor

- **`MIGRATION_INSTRUCTIONS.md`**
  - Detailed step-by-step guide

## Need Help?

If you're still experiencing issues after following this guide:

1. **Check the browser console** for specific error messages
2. **Check the Network tab** to see which queries are failing
3. **Verify migrations ran successfully** using the SQL queries above
4. **Check Supabase logs** for database errors

## Summary

✅ **Code is fixed** - All queries handle missing columns gracefully  
✅ **Migration ready** - Run `RUN_MIGRATION.sql` in Supabase Dashboard  
✅ **Cache needs clearing** - Rebuild and redeploy your live site  
✅ **Browser cache** - Clear and hard refresh  

After these steps, the 400 errors should be resolved and your admin panel should load correctly!


# Fix: CreateTenantDialog "Not Defined" Error

## Root Cause

The error `CreateTenantDialog is not defined` was caused by:

1. **Missing Database Tables**: The `tenants` and `tenant_users` tables may not exist in the database
2. **Module Evaluation Error**: TypeScript types fail validation when tables don't exist
3. **Import Chain Failure**: The component tries to use Supabase types that reference non-existent tables

## Solution

### Step 1: Apply Database Migrations

The tables are already defined in:
- `supabase/migrations/20251102000000_saas_platform_tenants.sql`

**Apply this migration to your Supabase database:**

```bash
# Using Supabase CLI
supabase migration up

# Or manually apply the SQL in Supabase Dashboard > SQL Editor
```

### Step 2: Ensure Tables Exist (New Migration)

I've created an additional migration that ensures tables exist with proper schema:
- `supabase/migrations/20251106000000_ensure_tenants_tables.sql`

This migration:
- ✅ Creates `tenants` table if it doesn't exist
- ✅ Creates `tenant_users` table if it doesn't exist  
- ✅ Adds proper RLS policies
- ✅ Creates necessary indexes
- ✅ Adds updated_at triggers

**Apply this migration as well.**

### Step 3: Verify Tables Exist

After applying migrations, verify in Supabase Dashboard:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tenants', 'tenant_users');

-- Should return:
-- tenants
-- tenant_users
```

### Step 4: Regenerate TypeScript Types

If using Supabase CLI with TypeScript generation:

```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

Or regenerate in Supabase Dashboard if using their type generator.

## What Was Fixed

1. ✅ **Import Statement** - Already fixed in `SuperAdminEnhanced.tsx`
2. ✅ **Type Assertions** - Component uses `as any` for table references
3. ✅ **Migration Created** - New migration ensures tables exist

## Component Usage

The `CreateTenantDialog` component:
- ✅ Imports correctly: `import { CreateTenantDialog } from '@/components/admin/CreateTenantDialog'`
- ✅ Used in: `src/pages/saas/SuperAdminEnhanced.tsx` (line 357)
- ✅ Creates tenant via: `supabase.from('tenants').insert(...)`
- ✅ Creates user via: `supabase.from('tenant_users').insert(...)`

## Expected Schema

### `tenants` Table Required Columns:
- `id` (UUID, PRIMARY KEY)
- `business_name` (TEXT)
- `slug` (TEXT, UNIQUE)
- `owner_email` (TEXT)
- `owner_name` (TEXT)
- `subscription_plan` (TEXT)
- `subscription_status` (TEXT)
- `limits` (JSONB)
- `features` (JSONB)
- `usage` (JSONB)
- `compliance_verified` (BOOLEAN)
- `onboarded` (BOOLEAN)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### `tenant_users` Table Required Columns:
- `id` (UUID, PRIMARY KEY)
- `tenant_id` (UUID, FK to tenants)
- `email` (TEXT)
- `name` (TEXT)
- `role` (TEXT)
- `status` (TEXT)
- `email_verified` (BOOLEAN)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

## Verification Steps

After applying migrations:

1. **Check Database**: Tables should exist in Supabase
2. **Test Component**: Navigate to `/saas/admin` 
3. **Click "Create Tenant"**: Dialog should open
4. **Fill Form**: Enter business details
5. **Submit**: Should create tenant successfully

## If Error Persists

If the error still occurs after applying migrations:

1. **Check Console**: Look for database connection errors
2. **Verify RLS Policies**: Ensure super admin can insert into tables
3. **Check TypeScript**: Regenerate Supabase types
4. **Clear Cache**: Clear browser cache and rebuild

## Related Files

- `src/components/admin/CreateTenantDialog.tsx` - Component implementation
- `src/pages/saas/SuperAdminEnhanced.tsx` - Usage location
- `supabase/migrations/20251102000000_saas_platform_tenants.sql` - Original migration
- `supabase/migrations/20251106000000_ensure_tenants_tables.sql` - Ensure tables exist


# Database Migration Application Order

## ⚠️ CRITICAL: Apply Migrations in This Exact Order

The migrations are numbered sequentially and **MUST** be applied in order to avoid dependency issues.

---

## Migration Sequence

### 1. `20251106000001_fix_tenant_users_rls_recursion.sql`
**Priority:** 🔴 **CRITICAL**  
**Purpose:** Fixes infinite recursion in tenant_users RLS policy

**What it does:**
- Creates `is_tenant_admin()` security definer function
- Drops old recursive policies
- Creates new non-recursive policies using the function

**Why first:** This function will be used by subsequent migrations that reference tenant_users.

---

### 2. `20251106000002_fix_public_read_policies.sql`
**Priority:** 🔴 **CRITICAL**  
**Purpose:** Removes public read access from sensitive tables

**What it does:**
- Removes public read from `disposable_menus` (protects access codes)
- Removes public read from `products` (protects pricing)
- Restricts `menu_security_events` to admin-only
- Updates related policies for `disposable_menu_products` and `menu_access_whitelist`

**Why second:** Needs the tenant isolation to be working properly.

---

### 3. `20251106000003_ensure_missing_tables.sql`
**Priority:** 🟡 **HIGH**  
**Purpose:** Ensures required tables exist

**What it does:**
- Creates `super_admin_actions` table (if not exists)
- Creates `invoices` table (if not exists)
- Adds RLS policies for both tables
- Adds indexes for performance

**Why third:** Creates tables that migrations 4 and 5 might reference.

---

### 4. `20251106000004_add_missing_columns.sql`
**Priority:** 🟡 **HIGH**  
**Purpose:** Adds missing columns to existing tables

**What it does:**
- Adds `stripe_customer_id` to `tenants` (if missing)
- Adds `limits` and `usage` JSONB columns to `tenants` (if missing)
- Adds white_label email/SMS branding fields
- Adds `description` and `display_name` to `subscription_plans`
- Adds `two_factor_enabled` to `super_admin_users`

**Why fourth:** Adds columns that the application expects to exist.

---

### 5. `20251106000005_add_missing_rls_policies.sql`
**Priority:** 🟡 **HIGH**  
**Purpose:** Adds RLS policies for 38+ tables without policies

**What it does:**
- Creates specific policies for `feature_flags`, `menu_access`, `menus`, `menu_products`, `usage_events`
- Uses a dynamic loop to create policies for remaining tables based on table structure
- Detects `tenant_id`, `user_id`, `account_id`, or `created_by` columns and creates appropriate policies

**Why last:** Needs all tables and columns to exist first, and uses the `is_tenant_admin()` function from migration 1.

---

## Application Methods

### Method 1: Supabase CLI (Recommended)
```bash
cd /path/to/project
supabase migration up
```

This will apply all pending migrations in order automatically.

### Method 2: Supabase Dashboard SQL Editor
1. Open Supabase Dashboard → SQL Editor
2. Copy the contents of each migration file
3. Paste and run them **one at a time** in order (00001 → 00005)
4. Verify each migration succeeds before proceeding

### Method 3: psql Command Line
```bash
# Connect to your database
psql -h <host> -U <user> -d <database>

# Apply migrations
\i supabase/migrations/20251106000001_fix_tenant_users_rls_recursion.sql
\i supabase/migrations/20251106000002_fix_public_read_policies.sql
\i supabase/migrations/20251106000003_ensure_missing_tables.sql
\i supabase/migrations/20251106000004_add_missing_columns.sql
\i supabase/migrations/20251106000005_add_missing_rls_policies.sql
```

---

## Verification Steps

After applying migrations, verify:

```sql
-- 1. Check function exists
SELECT proname FROM pg_proc WHERE proname = 'is_tenant_admin';

-- 2. Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('super_admin_actions', 'invoices');

-- 3. Check columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'tenants' 
AND column_name IN ('stripe_customer_id', 'limits', 'usage');

-- 4. Check policies exist (should return many rows)
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## Rollback (If Needed)

If you need to rollback a migration:

```sql
-- Rollback migration 5
DROP POLICY IF EXISTS "..." ON public.<table_name>;
-- (Repeat for each policy created)

-- Rollback migration 4
ALTER TABLE tenants DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE tenants DROP COLUMN IF EXISTS limits;
ALTER TABLE tenants DROP COLUMN IF EXISTS usage;
-- (Repeat for other tables)

-- Rollback migration 3
DROP TABLE IF EXISTS public.super_admin_actions CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;

-- Rollback migration 2
-- Restore old policies if needed (see migration file for details)

-- Rollback migration 1
DROP FUNCTION IF EXISTS public.is_tenant_admin(uuid, uuid);
-- Restore old policies if needed
```

**Note:** Supabase tracks migration history in `supabase_migrations.schema_migrations` table.

---

## Troubleshooting

### Error: "function already exists"
**Solution:** Migration is idempotent - it uses `CREATE OR REPLACE FUNCTION`, so this is safe to ignore.

### Error: "table already exists"
**Solution:** Migration uses `CREATE TABLE IF NOT EXISTS`, so this is safe to ignore.

### Error: "policy already exists"
**Solution:** Migration uses `DROP POLICY IF EXISTS` before creating, so re-running is safe.

### Error: "column already exists"
**Solution:** Migration checks if column exists before adding, so re-running is safe.

---

## Status Tracking

After applying migrations, update your tracking:

- [ ] Migration 00001 applied
- [ ] Migration 00002 applied
- [ ] Migration 00003 applied
- [ ] Migration 00004 applied
- [ ] Migration 00005 applied
- [ ] Verification queries passed
- [ ] Application tested

---

**Last Updated:** $(date)  
**Status:** Ready for application


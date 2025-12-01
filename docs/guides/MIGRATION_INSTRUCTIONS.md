# Migration Instructions: Add tenant_id to wholesale_deliveries

## Migration File
`supabase/migrations/20250202000000_fix_wholesale_deliveries_tenant_id.sql`

## How to Run This Migration

### Option 1: Supabase Dashboard SQL Editor (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste Migration**
   - Copy the entire contents of `supabase/migrations/20250202000000_fix_wholesale_deliveries_tenant_id.sql`
   - Paste it into the SQL Editor

4. **Run the Migration**
   - Click "Run" or press `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (Mac)
   - Wait for the query to complete

5. **Verify Success**
   - You should see a success message
   - Check the "NOTICES" section for confirmation messages:
     - `Added tenant_id column to wholesale_deliveries and populated from orders`
     - OR `wholesale_deliveries.tenant_id already exists` (if already run)

### Option 2: Supabase CLI (If Installed)

```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Link to your project (first time only)
supabase link --project-ref your-project-ref

# Run the migration
supabase db push
```

### Option 3: Via Supabase Migration API

If you have programmatic access, you can run migrations via the Supabase Management API.

## What This Migration Does

1. **Adds `tenant_id` column** to `wholesale_deliveries` table
2. **Populates existing records** by:
   - First trying to get `tenant_id` from related `wholesale_order`
   - If that fails, getting `tenant_id` from `wholesale_order` → `wholesale_clients`
3. **Creates an index** on `tenant_id` for better query performance
4. **Adds a comment** for documentation

## Safety Features

✅ **Idempotent**: Safe to run multiple times
- Checks if column exists before adding
- Won't duplicate data or cause errors if already run

✅ **Backward Compatible**: 
- App works before migration (queries handle missing columns gracefully)
- App works after migration (queries use tenant_id for proper isolation)

## Verification

After running the migration, verify it worked:

```sql
-- Check if column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'wholesale_deliveries' 
AND column_name = 'tenant_id';

-- Check if index exists
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'wholesale_deliveries' 
AND indexname = 'idx_wholesale_deliveries_tenant_id';

-- Check if data was populated (should return count > 0 if records exist)
SELECT COUNT(*) as total_deliveries,
       COUNT(tenant_id) as deliveries_with_tenant_id
FROM wholesale_deliveries;
```

## Expected Results

- ✅ Column `tenant_id` added to `wholesale_deliveries`
- ✅ Index `idx_wholesale_deliveries_tenant_id` created
- ✅ Existing records have `tenant_id` populated (if related orders/clients have tenant_id)
- ✅ New records will require `tenant_id` (via foreign key constraint)

## Troubleshooting

### Error: "relation 'wholesale_deliveries' does not exist"
- This means the table doesn't exist yet
- Run the base schema migrations first
- The migration will skip gracefully if table doesn't exist

### Error: "column 'tenant_id' already exists"
- This is expected if migration was already run
- The migration checks for this and skips gracefully
- You can safely ignore this or run the migration again

### Error: "relation 'tenants' does not exist"
- The `tenants` table must exist first
- Run tenant-related migrations before this one

## Notes

- This migration is **safe to run in production**
- It won't break existing functionality
- The app handles missing `tenant_id` gracefully before migration runs
- After migration, the app will use `tenant_id` for proper multi-tenant isolation


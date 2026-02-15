

## Fix: Finance Hub Errors (Expenses Table Missing + Column Mismatches)

### Problems Found

The Finance Hub's Expenses tab is completely broken due to two database issues visible in the network logs:

1. **`expenses` table does not exist** -- Every request to `/rest/v1/expenses` returns a 404. The Expense Tracking page tries to read and write to this table, but it was never created in the database.

2. **`wholesale_orders.updated_at` column does not exist** -- The wholesale orders query on the Finance Hub overview tab selects `updated_at`, but that column is not on the `wholesale_orders` table. This causes a 400 error on every page load. Same issue exists for `wholesale_deliveries.updated_at`.

### Fix Plan

#### Step 1: Create the `expenses` table

Create a new database table with RLS policies for tenant isolation:

```text
Table: expenses
Columns:
  - id (uuid, PK, default gen_random_uuid())
  - tenant_id (uuid, NOT NULL, FK to tenants)
  - description (text, NOT NULL)
  - amount (numeric, NOT NULL)
  - category (text)
  - notes (text)
  - created_at (timestamptz, default now())

RLS: enabled, policy allows all operations where tenant_id matches the user's tenant
Index: on tenant_id
```

#### Step 2: Remove `updated_at` from wholesale queries

In `src/hooks/useWholesaleData.ts`:
- **Line 52**: Remove `updated_at` from the `wholesale_orders` select string
- **Line 451**: Remove `updated_at` from the `wholesale_deliveries` select string

These columns don't exist on either table. Removing them from the select stops the 400 errors.

### Result

- The "Add Expense" button will work (table exists to insert into)
- The Finance Hub overview tab will load wholesale orders without errors
- All expense CRUD operations (list, add) will function correctly




# Fix Runtime Errors on Inventory Hub

## Problem Summary

You're seeing two runtime errors on the Inventory Hub page:

1. **Select.Item Error**: "A `<Select.Item />` must have a value prop that is not an empty string"
2. **HTTP 404 Error**: The Global Product Catalog is failing because required database tables and functions don't exist

---

## Error 1: SelectItem Empty String Values

### What's Happening
Radix UI Select components don't allow empty string `value=""` because an empty string is used to clear the selection. Using it causes the page to crash.

### Files Affected (6 total)

| File | Line | Current Value |
|------|------|---------------|
| `src/components/admin/FilterPanel.tsx` | 142 | `value=""` → `value="__all__"` |
| `src/components/shared/FilterPanel.tsx` | 131 | `value=""` → `value="__all__"` |
| `src/components/admin/recurring-orders/RecurringOrderSetup.tsx` | 392 | `value=""` → `value="__none__"` |
| `src/pages/admin/RunnerLocationTracking.tsx` | 338 | `value=""` → `value="__all__"` |
| `src/components/wholesale/EditWholesaleOrderDialog.tsx` | 344 | `value=""` → `value="__unassigned__"` |
| `src/pages/super-admin/CreditPackagesPage.tsx` | 448 | `value=""` → `value="__none__"` |

### Fix Strategy
Replace empty string values with a sentinel value like `"__all__"` or `"__none__"`, then update the corresponding handler logic to treat these sentinels as `null` or empty when processing.

---

## Error 2: Missing Global Product Catalog Database Objects

### What's Happening
The "Global" tab calls `search_global_products` RPC function, but the database migration that creates this was never applied. Missing:
- `global_products` table
- `global_product_imports` table  
- `search_global_products()` function
- `import_global_product()` function
- `sync_imported_products()` function

### Fix Strategy
Apply the existing migration file `supabase/migrations/20260110000016_global_product_catalog.sql` to create all required database objects.

---

## Implementation Plan

### Step 1: Apply Database Migration

Run the SQL from the migration file to create:
- Tables: `global_products`, `global_product_imports`
- RLS policies for proper access control
- RPC functions for search and import
- Indexes for performance

### Step 2: Fix SelectItem Values

Update each file to use non-empty sentinel values:

```typescript
// Before
<SelectItem value="">All</SelectItem>

// After  
<SelectItem value="__all__">All</SelectItem>
```

And update the handlers:

```typescript
// Before
onValueChange={(val) => handleFilterChange(filter.id, val || null)}

// After
onValueChange={(val) => handleFilterChange(filter.id, val === '__all__' ? null : val)}
```

---

## Files to Modify

| Type | File | Change |
|------|------|--------|
| Database | Migration | Apply `20260110000016_global_product_catalog.sql` |
| Frontend | `src/components/admin/FilterPanel.tsx` | Fix SelectItem value |
| Frontend | `src/components/shared/FilterPanel.tsx` | Fix SelectItem value |
| Frontend | `src/components/admin/recurring-orders/RecurringOrderSetup.tsx` | Fix SelectItem value |
| Frontend | `src/pages/admin/RunnerLocationTracking.tsx` | Fix SelectItem value |
| Frontend | `src/components/wholesale/EditWholesaleOrderDialog.tsx` | Fix SelectItem value |
| Frontend | `src/pages/super-admin/CreditPackagesPage.tsx` | Fix SelectItem value |

---

## Expected Result

After these fixes:
- ✅ Select components work without crashing
- ✅ Global Product Catalog loads and functions properly
- ✅ Product import/search features become operational
- ✅ No more HTTP 404 errors on the Global tab


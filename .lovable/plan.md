

# Fix "Failed to load data" on Products Page

## Root Cause

The products query in `ProductManagement.tsx` (line 356) selects `exclude_from_discounts` and `minimum_price` columns that don't exist in the `products` table. The database returns HTTP 400: `column products.exclude_from_discounts does not exist`.

Similarly, `useProduct.ts` (line 37) also selects these non-existent columns.

## Secondary Issue

Console also shows `stock_alerts` table doesn't exist (`useLowStockAlerts.ts` references `public.stock_alerts` but the hint says it should be `inventory_alerts`).

## Fix

### 1. ProductManagement.tsx (line 356)
Remove `exclude_from_discounts` and `minimum_price` from the `.select()` string. The component can default these to `false`/`null` since they don't exist in the DB yet.

### 2. useProduct.ts (line 37)
Same fix — remove `exclude_from_discounts, minimum_price` from the select string.

### 3. useLowStockAlerts.ts
Change table reference from `stock_alerts` to `inventory_alerts` (or remove the query if it's already falling back to products successfully).

**No database migration needed** — these are code-side fixes to stop requesting columns that don't exist.


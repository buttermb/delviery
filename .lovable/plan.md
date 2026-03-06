

# Fix: Inventory Hub "Failed to load data" + Build Error

## Two Issues

### 1. Database Query Error: `column products.metrc_retail_id does not exist`
The inventory hub loads `ProductManagement` as its default tab, which queries `products` table selecting `metrc_retail_id` -- a column that doesn't exist.

**File: `src/pages/admin/ProductManagement.tsx` (line 288)**
Remove `metrc_retail_id` from the select string. Also remove references to it in the product interface (line 79) and form mapping (line 103, 520).

**File: `src/hooks/useProduct.ts` (line 37)**
Same fix -- remove `metrc_retail_id` from the select string and interface (line 15).

### 2. Build Error: `replaceAll` not available
**File: `src/components/admin/dashboard/OrdersWidget.tsx` (lines 93, 196)**
Replace `.replaceAll('_', ' ')` with `.replace(/_/g, ' ')` (3 occurrences) to fix the TypeScript target compatibility issue.

## Changes Summary

| File | Change |
|------|--------|
| `src/pages/admin/ProductManagement.tsx` | Remove `metrc_retail_id` from select, interface, and form mapping |
| `src/hooks/useProduct.ts` | Remove `metrc_retail_id` from select and interface |
| `src/components/admin/dashboard/OrdersWidget.tsx` | Replace `replaceAll` with `replace(/_/g, ' ')` |


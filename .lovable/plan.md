

# Fix Dropdowns & Product Save

## Root Cause

**Two separate issues:**

1. **Dropdowns broken / vendor data fails to load**: The `useVendorsWithStats` hook queries `lead_time_days` from the `vendors` table, but that column doesn't exist. This causes an HTTP 400 error, which breaks the vendor selector dropdown. The vendor selector likely blocks or interferes with form interactivity when it's in an error state.

2. **Product Name won't save**: The `handleProductSubmit` function (ProductManagement.tsx line 633-634) sends `exclude_from_discounts`, `minimum_price`, and `tags` to the database, but none of these columns exist on the `products` table. The INSERT/UPDATE fails with a 400 error.

## Fix Plan

### 1. Remove `lead_time_days` from vendor queries
**File**: `src/hooks/useVendorsWithStats.ts`
- Remove `lead_time_days` from both `.select()` strings (lines 58 and 182)
- Remove from the `VendorWithStats` interface
- Remove from both return mappings (lines 147 and 232)

**Files**: `src/components/admin/products/ProductForm.tsx`, `src/components/admin/products/VendorSelector.tsx`, `src/pages/admin/VendorDetailPage.tsx`
- Remove UI references to `lead_time_days`

### 2. Remove non-existent columns from product save
**File**: `src/pages/admin/ProductManagement.tsx` (lines 633-635)
- Remove `exclude_from_discounts`, `minimum_price`, and `tags` from the `productData` object sent to the database

**File**: `src/components/admin/products/ProductForm.tsx`
- Keep `exclude_from_discounts`, `minimum_price`, `tags` in the form interface (UI-only for now) but they won't be persisted
- Remove `minimum_price` from price validation array (line 194)

### 3. Remove `minimum_price` validation reference
**File**: `src/components/admin/products/ProductForm.tsx` (line 194)
- Remove the `minimum_price` entry from the `priceFields` validation array since it's not a real DB column

**Summary**: 6 files modified. No database migrations needed — all fixes are removing references to non-existent columns.


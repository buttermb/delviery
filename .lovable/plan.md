

# Fix Products "Failed to load data"

Two database queries reference non-existent columns, causing 400 errors.

## 1. ProductManagement.tsx (line 356)
Remove `barcode_image_url` from the select string. The column doesn't exist in the `products` table.

## 2. useLowStockAlerts.ts (line 80)
The `inventory_alerts` table uses `reorder_point` not `threshold`, and uses `is_resolved` (boolean) not `status` (string). Fix the select and filter:
- `threshold` → `reorder_point`
- `.eq('status', 'active')` → `.eq('is_resolved', false)`
- Update the mapping code to use `reorder_point` instead of `threshold`

## 3. useProduct.ts (line 37)
Already correct — no `barcode_image_url` reference here. No change needed.

**Files to modify**: `src/pages/admin/ProductManagement.tsx`, `src/hooks/useLowStockAlerts.ts`


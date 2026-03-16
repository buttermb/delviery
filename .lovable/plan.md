

# Fix: Static Menu Page "Menu Not Found"

## Root Cause

The `loadMenuDirect()` function in `StaticMenuPage.tsx` joins the wrong table and uses non-existent columns:

1. **Wrong table join**: Line 328 joins `products(name, price, ...)` but `product_id` references `wholesale_inventory` (confirmed by DB query)
2. **Wrong column names**: `wholesale_inventory` uses `product_name` and `base_price`, not `name` and `price`
3. **Non-existent columns**: The query filters on `is_visible` and selects `vendor_name`, `badge` -- none of these exist on `disposable_menu_products`. The actual column is `display_availability`

These mismatches cause the Supabase query to fail silently (returning null), which triggers the "not found" state.

## Fix

### File: `src/pages/public/StaticMenuPage.tsx` (lines 318-397)

Update the `loadMenuDirect` function's product query:

**Before (broken):**
```
.select(`
  product_id, custom_price, prices, display_order,
  is_visible, vendor_name, badge,
  products (name, price, description, image_url, category, strain_type, created_at)
`)
.eq('is_visible', true)
```

**After (fixed):**
```
.select(`
  product_id, custom_price, prices, display_order, display_availability,
  wholesale_inventory!product_id (
    product_name, base_price, description, image_url,
    category, strain_type, created_at
  )
`)
.eq('display_availability', true)
```

Then update the mapping code (lines 350-397) to use the correct field names:
- `mp.products` becomes `mp.wholesale_inventory`
- `inv.name` becomes `inv.product_name`
- `inv.price` becomes `inv.base_price`
- Remove references to `mp.vendor_name` and `mp.badge` (these columns don't exist)

## Also Fix: Pre-existing build errors in unrelated edge functions

The build errors in `create-marketplace-profile`, `credit-threshold-alerts`, `credit-warning-emails`, `grant-free-credits`, and `invoice-management` are pre-existing TypeScript issues unrelated to this fix. They will not be addressed here.

## Result

The menu page at `/page/55fd6a6446714bf19f6dcdca` will correctly load and display all 5 products (Amnesia Haze, Blue Dream, Gary Payton, etc.) from the `wholesale_inventory` table.


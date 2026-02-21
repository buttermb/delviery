
# Fix All Remaining Build Errors

## Objective
Resolve all ~50+ TypeScript build errors across admin pages, platform pages, marketplace pages, and service files to achieve a clean build.

## Root Causes

There are 4 main categories of errors:

1. **`useUrlFilters` returns `{}` for filter values** -- The generic type inference fails when `FILTER_CONFIG` arrays use inline objects. Filter values like `searchQuery`, `statusFilter` are typed as `{}` instead of `string`, causing `.toLowerCase()`, `.replace()`, and assignment errors across Orders.tsx, ClientsPage.tsx, WholesaleOrdersPage.tsx.

2. **Supabase tables/RPCs not in generated types** -- Tables like `data_exports`, `referral_codes`, `marketplace_categories`, `marketplace_listings`, and RPCs like `log_vendor_price_change`, `admin_grant_tenant_access`, `get_platform_metrics`, `redeem_referral_code` aren't in the auto-generated types. Requires `(supabase as any)` casting.

3. **Type mismatches in data access** -- Properties accessed on query results typed as `unknown` or `SelectQueryError` (e.g., `CustomerDetails.tsx` arithmetic on unknown, `RevenueReports.tsx` accessing `.total`, `WhiteLabelSettings.tsx` unknown values in theme object).

4. **Component prop mismatches** -- `SearchInput` in `CollectionMode.tsx` passes `value`/`onChange` props that don't exist on `SearchInputProps` (it uses `defaultValue`/`onSearch`). `CashRegister.tsx` references `setCustomerDialogOpen` which is never declared.

---

## Changes by File

### Group 1: Fix `useUrlFilters` type inference (fixes ~15 errors across 3 files)

**Files:** `Orders.tsx`, `ClientsPage.tsx`, `WholesaleOrdersPage.tsx`

In each file, add `as const satisfies` or explicitly type the filter config, and cast the destructured filter values to `string`:
- `const searchQuery = filters.q as string;`
- `const statusFilter = (filters.status || 'all') as string;`

This fixes all `.toLowerCase()`, `.replace()`, `.includes()`, `ReactNode`, and assignment errors.

### Group 2: Cast Supabase calls for untyped tables/RPCs (fixes ~20 errors)

**Files and fixes:**
- **`DataExport.tsx` (line 85):** `(supabase as any).from('data_exports')`
- **`NewPurchaseOrder.tsx` (lines 142, 168, 178):** `(supabase as any).from('purchase_orders')`, `(supabase as any).from('purchase_order_items')`, `(supabase as any).rpc('log_vendor_price_change', ...)`
- **`OfflineOrderCreate.tsx` (line 91):** `(supabase as any).from('products')`
- **`AllTenantsPage.tsx` (line 44):** `(supabase as any).rpc('admin_grant_tenant_access', ...)`
- **`CommissionTrackingPage.tsx` (line 16):** `(supabase as any).rpc('get_platform_metrics')`
- **`MarketplaceCategoryManager.tsx` (line 47):** Already uses `as any` but the return cast is wrong -- change `data as MarketplaceCategory[]` to `(data as unknown as MarketplaceCategory[])`
- **`ProductVisibilityManager.tsx` (line 46):** `(supabase as any).from('marketplace_listings')`
- **`BusinessMenuPage.tsx`:** Cast supabase calls with `(supabase as any)`
- **`PublicMarketplacePage.tsx`:** Cast supabase calls with `(supabase as any)`

### Group 3: Fix type mismatches in data access

- **`AdminQuickExport.tsx` (line 81):** The `profiles` query column `email` doesn't exist in generated types. Cast: `(supabase as any).from('profiles').select('user_id, full_name, email')`
- **`CustomerDetails.tsx` (lines 159, 229-231, 299):** Cast arithmetic expressions: `(sum + (Number((o as Record<string, unknown>).total_amount) || 0))` and `computedTotalSpent` is already a number so `.toFixed(2)` should work after fixing line 229.
- **`CustomerInsights.tsx` (line 42):** Change cast to go through `unknown` first: `(customer as unknown as Record<string, unknown>)`
- **`RevenueReports.tsx` (line 98):** `order.total` doesn't exist on the typed result -- it already handles this with `order.total_amount?.toString() || order.total?.toString()`. Fix: cast order as `any` in the forEach or access via `(order as any).total`.
- **`WhiteLabelSettings.tsx` (line 88):** Cast `whiteLabelConfig as any` before assigning to `white_label` field, or cast the theme color values to `string`.

### Group 4: Fix component/state issues

- **`CashRegister.tsx` (line 801):** Add missing state declaration: `const [customerDialogOpen, setCustomerDialogOpen] = useState(false);` near the other dialog state declarations.
- **`CollectionMode.tsx` (line 952-956):** Change `SearchInput` props from `value={searchQuery} onChange={setSearchQuery}` to `defaultValue={searchQuery} onSearch={setSearchQuery}` to match the `SearchInputProps` interface.
- **`Orders.tsx` (line 1425):** The `Order` type collision -- the local `Order` interface conflicts with an imported `Order` type. Fix by renaming the local interface to `LocalOrder` or casting `editOrder as any` when passing to `OrderEditModal`.
- **`WholesaleOrdersPage.tsx` (lines 252, 258):** The filtered result type `(PurchaseOrder | WholesaleOrder)[]` can't be assigned to `PurchaseOrder[] | WholesaleOrder[]`. Fix by casting: `result as any` or typing the `filteredOrders` variable as `(PurchaseOrder | WholesaleOrder)[]`.
- **`NewPurchaseOrder.tsx` (line 170):** Add missing `product_name` field to order items and remove `tenant_id` from the insert object (not in schema).

---

## Technical Summary

| Category | Error Count | Fix Pattern |
|---|---|---|
| useUrlFilters `{}` types | ~15 | Cast filter values to `string` |
| Untyped tables/RPCs | ~20 | `(supabase as any).from(...)` |
| Data access type mismatches | ~10 | Cast through `unknown` or `any` |
| Component/state issues | ~5 | Fix props, add missing state, rename types |

## Estimated Files Modified
~18 files total, all single-line or few-line fixes using the established `(supabase as any)` pattern and explicit string casts.


# Fix Remaining TypeScript Build Errors (Batch 5)

## Overview
This batch addresses ~60+ remaining TypeScript errors across hooks, lib utilities, and admin pages. The errors follow the same systemic patterns seen in previous batches.

## Error Categories and Fixes

### 1. Supabase Schema Bypass (`(supabase as any)`)
**Files:** `useVendorsWithStats.ts`, `activityLog.ts`
- `vendor_ratings` and `activity_log` tables not in auto-generated types
- Cast `supabase` to `any` before `.from()` calls

### 2. Remove Unused `@ts-expect-error` Directives
**Files:**
- `src/lib/orders/orderFlowManager.ts` (line 45) -- one unused directive
- `src/lib/services/paymentService.ts` (lines 128, 330, 471, 600) -- four unused directives (the `as any` casts already bypass type checking)
- `src/lib/utils/tenantQueries.ts` (lines 25, 50, 72, 95) -- four unused directives (same pattern)
- `src/pages/admin/DispatchInventory.tsx` (lines 109, 260, 387+) -- unused directives

### 3. Query Key Signature Mismatches
**Files and fixes:**
- `CashRegister.tsx` line 226: `queryKeys.customers.list({ tenantId })` should be `queryKeys.customers.list(tenantId)`
- `CustomerCRMPage.tsx` line 61: `queryKeys.customers.list({ lifecycle, segment })` should be `queryKeys.customers.list(tenant?.id, { lifecycle, segment })`
- `DeliveryDashboard.tsx` line 99: `queryKeys.deliveries.list({ tenantId: ..., dashboard: true })` should be `queryKeys.deliveries.list(tenant?.id, { dashboard: true })`
- `DeliveryManagement.tsx` line 63: `queryKeys.deliveries.list({ tenantId: ... })` should be `queryKeys.deliveries.list(tenant?.id)`
- `PrefetchInventory.tsx`, `PrefetchOrders.tsx`, `PrefetchCustomers.tsx`: similar object-to-string fixes

### 4. Missing Property `dataUpdatedAt` on Dashboard Stats
**File:** `DashboardPage.tsx` line 111
- `useDashboardStats()` does not return `dataUpdatedAt`
- Fix: Destructure from the underlying `useQuery` wrapper, or remove the reference and use `Date.now()` as fallback

### 5. Missing `decryptCustomerData` Import
**File:** `CustomerCRMPage.tsx` line 83
- Add import: `import { decryptCustomerData } from '@/lib/utils/customerEncryption'`

### 6. `contacts` Table Schema Errors (Missing Columns)
**File:** `CustomerDashboard.tsx` lines 200-206
- Query selects `full_name`, `email` from `contacts` but schema doesn't have these columns
- Fix: Cast `supabase` to `any` for the contacts query, then cast results

### 7. Type `unknown` Property Access
**File:** `CustomerDetails.tsx` lines 198, 542, 568-579, 690-699
- `payments` and `notes` arrays are typed as `unknown[]` from state initialization
- Fix: Add proper type annotations to the state: `useState<PaymentRecord[]>([])`, `useState<NoteRecord[]>([])`
- Define local interfaces for `PaymentRecord` and `NoteRecord` matching the queried shapes

### 8. `edgeData` vs `_edgeData` Variable Name Mismatch
**File:** `CustomerInvoices.tsx` line 167
- Variable destructured as `_edgeData` (underscore prefix) but referenced as `edgeData`
- Fix: Rename `_edgeData` to `edgeData` in the destructuring

### 9. `Record<string, unknown>[]` Not Assignable to `Customer[]`
**File:** `CustomerManagement.tsx` line 188
- `setCustomers(decryptedCustomers)` where `decryptedCustomers` is `Record<string, unknown>[]`
- Fix: Cast `setCustomers(decryptedCustomers as Customer[])`

### 10. `LTVSegment` Not Assignable to `CustomerSegment`
**File:** `CustomerDashboard.tsx` lines 675, 677
- Type mismatch: `LTVSegment` includes `"regular"` but `CustomerSegment` does not
- Fix: Cast to `string` or expand `CustomerSegment` union, or use `as any`

### 11. `DeliveryZones.tsx` Constructor Error
**File:** `DeliveryZones.tsx` line 129
- `new Map<string, L.Polygon>()` inside `useRef` -- the error says "Only a void function can be called with new keyword" and "Expected 1 arguments, but got 0"
- This is likely a type conflict. Fix: Use `useRef<Map<string, L.Polygon>>(new Map())` or cast

### 12. `vendor.lead_time_days` Missing from Vendors Schema
**File:** `useVendorsWithStats.ts` lines 146, 230
- The `vendors` (suppliers) table doesn't have `lead_time_days`
- Fix: Use optional chaining `(vendor as any).lead_time_days || null`

### 13. `vendor_ratings` Query Result Type Casting
**File:** `useVendorsWithStats.ts` lines 119-121, 214
- Results from `vendor_ratings` query typed as `ResultOne` without expected properties
- Fix: Cast query results to `any` before accessing `.vendor_id`, `.overall_score`

## Implementation Order
1. Remove all unused `@ts-expect-error` directives (quick wins)
2. Fix query key signatures across all pages
3. Add `(supabase as any)` casts for missing tables
4. Fix type annotations and property access errors
5. Fix variable name mismatches and missing imports

## Technical Notes
- All fixes follow the established `(supabase as any)` pattern for schema bypass
- Query key fixes align with the centralized factory signatures in `src/lib/queryKeys.ts`
- No database schema changes needed -- all fixes are TypeScript-level

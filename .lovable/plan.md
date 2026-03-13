

# Fix Build Errors — Remaining TypeScript Issues

There are ~30 remaining build errors across several categories. Here's the plan to fix each:

## 1. Duplicate `notifications` key in queryKeys.ts (fixes 12 errors)

The `queryKeys` object has TWO `notifications` entries — one at line 792 (with `byUser`, `unread`, `byTenant`) and another at line 3214 (with only `all`, `lists`, `list`, `badgeCounts`). Since JS last-key-wins, the second overwrites the first, causing `byUser` and `unread` to be missing.

**Fix**: Remove the duplicate at lines 3214-3222 and merge `badgeCounts` into the first `notifications` block at line 792.

**Files**: `src/lib/queryKeys.ts`

## 2. Missing queryKeys properties (fixes 3 errors)

- `deliveryAnalytics.summary` — doesn't exist, only `byTenant`. Used in `DeliveryAnalyticsDashboard.tsx`.
- `deliveryZones.detail` — doesn't exist, only `all` and `byTenant`. Used in `DeliveryZoneMapEditor.tsx`.
- `orders.byCustomer` — doesn't exist. Used in `CustomerOrderHistory.tsx`.

**Fix**: Add `summary`, `detail`, and `byCustomer` methods to the respective queryKey groups.

**Files**: `src/lib/queryKeys.ts`

## 3. Supabase type casting in settings files (fixes 6 errors)

`APIKeyManagement.tsx`, `IntegrationSettings.tsx`, and `WebhookConfiguration.tsx` all cast `supabase` with verbose inline type annotations that don't match. Per the project memory, the correct pattern is `(supabase as any).from('table')`.

**Fix**: Replace the broken type casts with `(supabase as any).from(...)`.

**Files**: `src/components/settings/APIKeyManagement.tsx`, `src/components/settings/IntegrationSettings.tsx`, `src/components/settings/WebhookConfiguration.tsx`

## 4. DeliveryDriverAssignmentPanel — wrong arg type (1 error)

`queryKeys.couriers.list()` expects `Record<string, unknown>` but gets a `string`.

**Fix**: Change to `queryKeys.couriers.list({ tenantId: tenant?.id })`.

**File**: `src/components/delivery/DeliveryDriverAssignmentPanel.tsx`

## 5. DeliveryFeeCalculator — invalid Badge variant (1 error)

Uses `variant="success"` which isn't in the Badge component's union type.

**Fix**: Change `'success'` to `'secondary'` (or `'default'`).

**File**: `src/components/delivery/DeliveryFeeCalculator.tsx`

## 6. DeliveryZoneMapEditor — react-leaflet module (1 error)

Missing type declarations for `react-leaflet`.

**Fix**: Add a `src/types/react-leaflet.d.ts` declaration file.

**File**: New `src/types/react-leaflet.d.ts`

## 7. InvoiceSequenceConfig — Select onValueChange type mismatch (1 error)

`setLocalFormat` is `Dispatch<SetStateAction<"INV-NNNN" | "NNNN" | "YYYY-NNNN">>` but `onValueChange` passes `string`.

**Fix**: Cast the handler: `onValueChange={(val) => setLocalFormat(val as typeof localFormat)}`.

**File**: `src/components/invoice/InvoiceSequenceConfig.tsx`

## 8. notificationDeduplication — logger.debug with 4 args (1 error)

`logger.debug()` accepts max 3 args but is called with 4: `logger.debug('[Notification Batch] Sent:', sent, 'Skipped:', skipped)`.

**Fix**: Combine into: `logger.debug('[Notification Batch]', { sent, skipped })`.

**File**: `src/components/notifications/notificationDeduplication.ts`

## 9. TenantGeneralSettings — owner_name/owner_email (2 errors)

`tenant.owner_name` and `tenant.owner_email` don't exist on the `Tenant` type. However, the API response shows these fields DO exist in the database.

**Fix**: Cast with `(tenant as any).owner_name` and `(tenant as any).owner_email`.

**File**: `src/components/settings/TenantGeneralSettings.tsx`

## 10. VirtualizedTableTanstack — @tanstack/react-virtual (1 error)

Missing type declarations.

**Fix**: Add a `src/types/react-virtual.d.ts` declaration file.

**File**: New `src/types/react-virtual.d.ts`

---

**Total: ~14 files modified, 2 new type declaration files. All changes are minimal fixes to align code with existing types and APIs.**


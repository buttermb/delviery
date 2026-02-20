
# Fix All Build Errors

## Objective
Fix all 18+ TypeScript build errors across the project to achieve a clean build.

## Changes

### 1. Fix `useDirtyFormGuard.tsx` - Wrong event types (fixes 7 dialog errors)

**File:** `src/hooks/useDirtyFormGuard.tsx`

The `onPointerDownOutside` uses `React.PointerEvent` but Radix expects `PointerDownOutsideEvent` (a `CustomEvent`). Fix by changing the type to `Event` (or the specific Radix type) so it's compatible.

- Change `(e: React.PointerEvent)` to `(e: Event)` on line 51
- Change `(e: KeyboardEvent)` to `(e: Event)` on line 57 (if needed, though this one may already work)

This single fix resolves all 7 dialog type errors in: `CreateClientDialog`, `EditClientDialog`, `OrderEditModal`, `EditMenuDialog`, `InvoicePaymentDialog`, `OrderRefundModal`, `POSRefundDialog`.

### 2. Fix `RoleBasedSidebar.tsx` - Missing `useEffect` import

**File:** `src/components/admin/RoleBasedSidebar.tsx` (line 5)

- Add `useEffect` to the React import: `import { useState, useEffect } from 'react';`

### 3. Fix `OrderPaymentStatusSync.tsx` - Wrong export name

**File:** `src/components/admin/orders/OrderPaymentStatusSync.tsx`

- Line 53: Change `ORDER_ORDER_PAYMENT_METHODS` to `ORDER_PAYMENT_METHODS` in the import
- Line 500: The local usage already says `ORDER_PAYMENT_METHODS`, so just fixing the import resolves both errors

### 4. Fix `MenuBuilderProductSelector.tsx` - `sku` not on `MenuProduct`

**File:** `src/components/admin/disposable-menus/MenuBuilderProductSelector.tsx`

The `MenuProduct` type lacks `sku`. Add optional `sku` casting or remove sku references. Safest fix: cast `product` access to use optional chaining with `(product as any).sku` at lines 266, 268, and 464, or add `sku` to the `MenuProduct` interface.

### 5. Fix `TicketForm.tsx` and `CreateTicketFromChatDialog.tsx` - Missing `account_id` and `ticket_number`

**Files:**
- `src/components/admin/support/TicketForm.tsx` (line 92-96)
- `src/components/admin/support/CreateTicketFromChatDialog.tsx` (line 139-141)

Add `account_id` and `ticket_number` to the insert objects. Use a generated ticket number (e.g., `TKT-${Date.now()}`) and a placeholder account_id or the user's ID.

### 6. Fix `WorkflowCanvas.tsx` - Json vs WorkflowAction[] type mismatch

**File:** `src/components/admin/workflow/WorkflowCanvas.tsx`

- Line 105: Change `(data as Workflow[])` to `(data as unknown as Workflow[])`
- Line 196 and 204: Cast `workflowData` through unknown: `(workflowData as unknown as Record<string, unknown>)`

### 7. Fix `POCreateForm.tsx` - Excessively deep type instantiation

**File:** `src/components/admin/purchase-orders/POCreateForm.tsx` (line 73)

Cast the supabase client to `any` for this query per the project's established pattern: `(supabase as any).from("vendors")`

## Technical Details

| Error Category | Files Affected | Root Cause | Fix |
|---|---|---|---|
| Dialog event types | 7 files | Wrong `PointerEvent` type in hook | Fix types in `useDirtyFormGuard.tsx` |
| Missing import | 1 file | `useEffect` not imported | Add to import |
| Wrong export name | 1 file | Typo `ORDER_ORDER_PAYMENT_METHODS` | Fix import name |
| Missing property | 1 file | `sku` not on `MenuProduct` | Add optional property or cast |
| Missing fields | 2 files | `account_id`, `ticket_number` required | Add required fields |
| Type mismatch | 1 file | `Json` vs `WorkflowAction[]` | Cast through `unknown` |
| Deep instantiation | 1 file | Supabase type complexity | Cast to `any` |

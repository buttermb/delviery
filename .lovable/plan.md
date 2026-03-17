

# Wire 3 Stub Row Actions in DriverRowActionsMenu

## Overview

Three dropdown items in `DriverRowActionsMenu.tsx` have no `onClick` handlers: **View Profile**, **Edit Details**, and **Resend Invite**. Additionally, the "View Profile" toast action in `AddDriverDialog.tsx` has an empty callback.

## Changes

### 1. `src/components/drivers/DriverRowActionsMenu.tsx`

**Add navigation prop + resend invite mutation:**

- Accept `onViewProfile?: (id: string) => void` and `onEditDetails?: (id: string) => void` callback props (keeps the component decoupled from routing).
- **View Profile**: `onClick={() => onViewProfile?.(driver.id)}` — navigates to `/admin/drivers/:driverId`.
- **Edit Details**: `onClick={() => onEditDetails?.(driver.id)}` — navigates to `/admin/drivers/:driverId?tab=details` (or same profile page, "Details" tab).
- **Resend Invite**: Add a mutation mirroring the existing pattern in `ActivationBanner.tsx` — calls `supabase.functions.invoke('add-driver', { body: { resend_invite: true, driver_id: driver.id } })`. Disable when pending or driver is already active.

### 2. `src/components/drivers/DriverTableRow.tsx`

- Accept `onViewProfile` and `onEditDetails` props, pass them through to `DriverRowActionsMenu`.

### 3. `src/components/drivers/DriverTable.tsx`

- Accept `onViewProfile` and `onEditDetails` props, pass them through to each `DriverTableRow`.

### 4. `src/pages/drivers/DriverDirectoryPage.tsx`

- Wire the callbacks using `useTenantNavigate`:
  - `onViewProfile: (id) => navigate(\`/admin/drivers/${id}\`)`
  - `onEditDetails: (id) => navigate(\`/admin/drivers/${id}?tab=details\`)`

### 5. `src/components/drivers/AddDriverDialog.tsx`

- Wire the "View Profile" toast action to navigate to `/admin/drivers/${data.driver_id}` using `useTenantNavigate`.

## Files Changed

| File | Change |
|------|--------|
| `DriverRowActionsMenu.tsx` | Add `onViewProfile`/`onEditDetails` props + resend invite mutation |
| `DriverTableRow.tsx` | Pass through new props |
| `DriverTable.tsx` | Pass through new props |
| `DriverDirectoryPage.tsx` | Wire navigation callbacks |
| `AddDriverDialog.tsx` | Wire toast "View Profile" navigation |


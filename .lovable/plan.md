

# Fix "Driver not found" — Non-existent Column References

## Root Cause

The driver profile query on `DriverProfilePage.tsx` (line 122-133) selects three columns that do not exist on the `couriers` table:

| Referenced Column | Actual Column |
|---|---|
| `insurance_expiry` | Does not exist |
| `suspension_reason` | `suspend_reason` |
| `terminated_at` | Does not exist |

This causes a PostgREST 400 error, which makes `data` null, triggering the "Driver not found" message.

## Fix

**File: `src/pages/drivers/DriverProfilePage.tsx`**

1. Remove `insurance_expiry` and `terminated_at` from the select query (lines 126-128)
2. Change `suspension_reason` to `suspend_reason`
3. Update the `DriverProfile` interface (lines 26-55) to match:
   - Remove `insurance_expiry` field
   - Remove `terminated_at` field  
   - Rename `suspension_reason` to `suspend_reason`

4. Search all tab components that reference these fields and update accordingly:
   - `ProfileHeader.tsx` — may reference `suspension_reason`
   - `OverviewTab.tsx`, `VehicleTab.tsx` — may reference `insurance_expiry`

**Downstream files to check/fix** (same renames):
- `src/components/drivers/profile/ProfileHeader.tsx`
- `src/components/drivers/profile/tabs/OverviewTab.tsx`
- `src/components/drivers/profile/tabs/VehicleTab.tsx`
- `src/components/drivers/profile/tabs/ScheduleTab.tsx`
- Any other component importing `DriverProfile` type


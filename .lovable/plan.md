
# Fix Plan: Dashboard Crashes and Build Errors

## Problem Summary

Your dashboard is crashing with two main runtime errors:
1. **"Cannot read properties of undefined (reading 'dashboard')"** - The notification bell component tries to use a query key that doesn't exist
2. **"useIsMobile is not defined"** - Missing hook import/export issue

Additionally, there are **40+ build errors** across multiple files that need fixing.

---

## Phase 1: Fix Dashboard-Blocking Errors

### 1.1 Add Missing `alerts` Section to Query Keys
**File:** `src/lib/queryKeys.ts`

The `useDashboardAlerts` hook references `queryKeys.alerts.dashboard()`, but no `alerts` section exists. I'll add it:

```text
alerts: {
  all: ['alerts'] as const,
  dashboard: (tenantId: string) => ['alerts', 'dashboard', tenantId] as const,
  predictive: (tenantId: string) => ['alerts', 'predictive', tenantId] as const,
},
```

### 1.2 Fix `useIsMobile` Import Issue
**File:** `src/pages/tenant-admin/DashboardPage.tsx`

The import points to `@/hooks/use-mobile` but may need verification that the export matches. There are two mobile hook files:
- `use-mobile.tsx` - exports `useIsMobile`
- `useIsMobile.ts` - need to check this file

---

## Phase 2: Fix Build Errors (40+ errors across 15 files)

### 2.1 Missing Icon/Component Imports

| File | Missing | Fix |
|------|---------|-----|
| `ModernDashboard.tsx` | `WeatherWidget` | Remove or create component |
| `OrderRowContextMenu.tsx` | `PauseCircle`, `PlayCircle` | Add imports from lucide-react |
| `MenuCard.tsx` | `Monitor` | Add import from lucide-react |
| `HotboxDashboard.tsx` | `ReadyForPickupWidget` | Create or import component |
| `ProductQRGenerator.tsx` | `Skeleton` | Add import from ui/skeleton |

### 2.2 Type Mismatches

| File | Issue | Fix |
|------|-------|-----|
| `OrderEditModal.tsx` | Missing `product_id`, `quantity`, `subtotal` fields | Add required fields to order items |
| `OrderRowContextMenu.tsx` | `"hold"` and `"resume"` not valid `OrderContextAction` | Add to type definition |
| `ProductArchiveButton.tsx` | `deleted_at` not in product type | Remove field or add to type |
| `ProductCard.tsx` | `onArchive` undefined | Fix prop name/destructuring |
| `StockAdjustmentModal.tsx` | `user` not in context | Use correct property from auth context |

### 2.3 Database Column Errors

| File | Issue | Fix |
|------|-------|-----|
| `DashboardSearchBar.tsx` | `email` column doesn't exist on `profiles`, `name` on `couriers`, `suppliers` table | Fix column names to match database schema |
| `OrdersWidget.tsx` | `order_source`, `user_id` columns missing from `orders` | Update query to use correct columns |
| `StockAdjustmentModal.tsx` | `inventory_history` table not in types | Use correct table name or cast to bypass |

### 2.4 Deep Instantiation Errors
**File:** `DashboardSearchBar.tsx` (line 232)

Apply the established pattern: cast Supabase client to `any` to bypass recursive type check.

---

## Phase 3: Verify and Test

After fixes, verify:
1. Dashboard loads without crashing
2. Notification bell displays alerts
3. Mobile layout works on small screens
4. No TypeScript build errors remain

---

## Technical Details

### Files to Modify (Priority Order)

1. `src/lib/queryKeys.ts` - Add `alerts` query key section
2. `src/hooks/useIsMobile.ts` - Verify export matches import
3. `src/components/admin/ModernDashboard.tsx` - Remove/fix WeatherWidget
4. `src/components/admin/OrderEditModal.tsx` - Add missing fields
5. `src/components/admin/OrderRowContextMenu.tsx` - Add action types and icons
6. `src/components/admin/ProductArchiveButton.tsx` - Remove `deleted_at` field
7. `src/components/admin/ProductCard.tsx` - Fix prop destructuring
8. `src/components/admin/ProductQRGenerator.tsx` - Add Skeleton import
9. `src/components/admin/StockAdjustmentModal.tsx` - Fix auth context usage
10. `src/components/admin/dashboard/DashboardSearchBar.tsx` - Fix column queries
11. `src/components/admin/dashboard/OrdersWidget.tsx` - Fix column references
12. `src/components/admin/dashboard/RecentCustomersWidget.tsx` - Remove unused directive
13. `src/components/admin/disposable-menus/MenuCard.tsx` - Add Monitor import
14. `src/components/admin/hotbox/HotboxDashboard.tsx` - Fix widget reference
15. `src/components/admin/hotbox/widgets/CourierStatusWidget.tsx` - Fix icon props

### Estimated Changes
- ~15 files modified
- ~50 lines of code changes
- No database migrations needed

---

## Risk Assessment
- **Low risk**: All changes are code-level fixes with no database modifications
- The fixes follow established patterns already used in the codebase
- Changes are isolated to specific components

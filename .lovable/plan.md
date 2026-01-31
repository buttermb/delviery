

# Fix Module Loading Error for DisposableMenus Page

## Problem Summary

The "Menus" tab in the Inventory Hub fails to load with the error:
```
Failed to fetch dynamically imported module: .../src/pages/admin/DisposableMenus.tsx
```

This is a **dynamic import failure** that commonly occurs when:
- Stale cache/service worker serves outdated module references
- Build artifacts have changed between deployments
- Heavy modules fail to load on slow connections

## Root Cause Analysis

The InventoryHubPage uses standard `lazy()` for DisposableMenus instead of the project's `lazyWithRetry()` wrapper:

```typescript
// Current (problematic)
const DisposableMenus = lazy(() => import('@/pages/admin/DisposableMenus'));

// Should be
const DisposableMenus = lazyWithRetry(() => import('@/pages/admin/DisposableMenus'));
```

The `lazyWithRetry` utility provides:
- **3 automatic retries** with exponential backoff
- **Graceful fallback UI** with "Clear Cache & Reload" button
- **Error logging** for debugging

## Implementation Plan

### Step 1: Update InventoryHubPage Imports

**File:** `src/pages/admin/hubs/InventoryHubPage.tsx`

Changes:
1. Import `lazyWithRetry` from `@/utils/lazyWithRetry`
2. Replace `lazy()` with `lazyWithRetry()` for all heavy page imports:
   - DisposableMenus
   - ProductManagement
   - InventoryDashboard
   - InventoryManagement
   - InventoryMonitoringPage
   - FrontedInventory
   - DispatchInventory
   - GenerateBarcodes

### Step 2: Update App.tsx Imports

**File:** `src/App.tsx`

Verify all admin pages use `lazyWithRetry`:
- DisposableMenus (line 187)
- DisposableMenuAnalytics (line 188)
- Other heavy admin pages

### Step 3: Enhance Error Boundary for Tab Content

**File:** `src/pages/admin/hubs/InventoryHubPage.tsx`

Wrap each TabsContent in an ErrorBoundary to catch module failures without crashing the entire page:

```typescript
<TabsContent value="menus">
  <ErrorBoundary fallback={<ModuleErrorFallback tabName="Menus" />}>
    <Suspense fallback={<TabSkeleton />}>
      <DisposableMenus />
    </Suspense>
  </ErrorBoundary>
</TabsContent>
```

### Step 4: Add Tab-Specific Error Fallback Component

Create a friendly error state that:
- Shows which tab failed
- Provides "Retry" and "Clear Cache" buttons
- Doesn't require full page reload

---

## Technical Details

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/admin/hubs/InventoryHubPage.tsx` | Replace `lazy()` with `lazyWithRetry()`, add ErrorBoundary wrappers |
| `src/App.tsx` | Ensure admin pages use `lazyWithRetry()` |

### Why lazyWithRetry Works

The utility already handles this exact error pattern:

```typescript
const isModuleError = 
  error instanceof Error && (
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('chunk') ||
    error.message.includes('Loading') ||
    error.message.includes('NetworkError')
  );
```

When detected, it:
1. Retries the import 3 times with exponential backoff (1s, 2s, 4s)
2. Returns a fallback component with "Clear Cache & Reload" button
3. Logs the error for debugging

### Additional Robustness

Also update these hub pages to use `lazyWithRetry`:
- `OrdersHubPage.tsx`
- `CustomerHubPage.tsx`
- `FinanceHubPage.tsx`
- `FulfillmentHubPage.tsx`
- `StorefrontHubPage.tsx`

---

## Expected Outcome

After implementation:
- **Automatic retries** prevent transient network failures
- **Graceful degradation** shows friendly error with clear fix action
- **No page crashes** - only the affected tab shows error state
- **Cache clearing** works correctly when needed

## Quick Workaround (Immediate)

If you're currently stuck, clicking "Clear Cache & Reload" should resolve the issue. This fix ensures future occurrences are handled gracefully.


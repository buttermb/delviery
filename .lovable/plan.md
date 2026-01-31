
# Build Error Fix Plan

## Overview
There are **22 TypeScript errors** across multiple files that need to be fixed before the build can succeed. These fall into 4 categories:

1. **Missing imports** in marketing components
2. **Missing queryKeys entries** in the query key factory  
3. **Unused ts-expect-error directive**
4. **Props type mismatch**

---

## Error Summary

| Category | Files Affected | Error Count |
|----------|----------------|-------------|
| Missing imports | 3 files | 4 errors |
| Missing queryKeys | 5 files | 16 errors |
| Unused directive | 1 file | 1 error |
| Props mismatch | 1 file | 1 error |

---

## Fix Plan

### 1. Marketing Components - Missing Imports

#### File: `src/components/marketing/ModernHero.tsx`
**Issues:**
- Line 28: `useEffect` is not imported
- Line 30: `ROTATING_FEATURES` is referenced but was removed

**Fix:**
- Add `useEffect` to imports from React
- Remove the `useEffect` block that references the deleted `ROTATING_FEATURES` constant (lines 28-33)
- Remove unused `featureIndex` state since it's not used elsewhere

#### File: `src/components/marketing/TrustedBy.tsx`  
**Issues:**
- Lines 41, 46: `DISTRIBUTORS` is undefined - should use `companies` constant defined at top

**Fix:**
- Replace `DISTRIBUTORS` with `companies` in both map() calls

#### File: `src/components/marketing/dashboard/DashboardViews.tsx`
**Issue:**
- Line 31: `useSpring` is used but not imported from framer-motion

**Fix:**
- Add `useSpring` to the framer-motion imports

---

### 2. Query Keys - Missing Entries

#### File: `src/lib/queryKeys.ts`
**Missing entries that need to be added:**

```typescript
// Add after line 162 (after dashboard section):
alerts: {
  all: ['alerts'] as const,
  dashboard: (tenantId: string) => 
    [...queryKeys.alerts.all, 'dashboard', tenantId] as const,
  predictive: (tenantId: string) => 
    [...queryKeys.alerts.all, 'predictive', tenantId] as const,
},

// Add to finance section (after line 260):
snapshot: (tenantId?: string) =>
  [...queryKeys.finance.all, 'snapshot', { tenantId }] as const,
cashFlow: (tenantId?: string) =>
  [...queryKeys.finance.all, 'cash-flow', { tenantId }] as const,
creditOut: (tenantId?: string) =>
  [...queryKeys.finance.all, 'credit-out', { tenantId }] as const,
monthlyPerformance: (tenantId?: string) =>
  [...queryKeys.finance.all, 'monthly-performance', { tenantId }] as const,

// Add after line 48 (in orders section):
live: (tenantId?: string) => 
  [...queryKeys.orders.all, 'live', tenantId] as const,

// Add new top-level sections:
recurringOrders: {
  all: ['recurring-orders'] as const,
  lists: () => [...queryKeys.recurringOrders.all, 'list'] as const,
  list: (tenantId?: string) =>
    [...queryKeys.recurringOrders.lists(), { tenantId }] as const,
  detail: (id: string) => 
    [...queryKeys.recurringOrders.all, id] as const,
},

weather: {
  all: ['weather'] as const,
  current: (location?: string) => 
    [...queryKeys.weather.all, 'current', location] as const,
  forecast: (location?: string) => 
    [...queryKeys.weather.all, 'forecast', location] as const,
},
```

---

### 3. Unused Directive

#### File: `src/components/admin/dashboard/RevenueChartWidget.tsx`
**Issue:**
- Line 35: `@ts-expect-error` directive is no longer needed

**Fix:**
- Remove the `@ts-expect-error` comment on line 35

---

### 4. Props Type Mismatch

#### File: `src/pages/admin/Orders.tsx`
**Issue:**
- Line 1056: `className` prop doesn't exist on `EnhancedEmptyStateProps`

**Fix:**
- Need to check the `EnhancedEmptyState` component to verify if `className` should be added to its props, or if it should be removed from this usage

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/queryKeys.ts` | Add 5 missing query key sections |
| `src/components/marketing/ModernHero.tsx` | Add useEffect import, remove dead code |
| `src/components/marketing/TrustedBy.tsx` | Change DISTRIBUTORS → companies |
| `src/components/marketing/dashboard/DashboardViews.tsx` | Add useSpring import |
| `src/components/admin/dashboard/RevenueChartWidget.tsx` | Remove unused @ts-expect-error |
| `src/pages/admin/Orders.tsx` | Remove or fix className prop |

---

## Implementation Order

1. **queryKeys.ts** - Fix first since multiple hooks depend on it
2. **Marketing components** - Quick import fixes
3. **RevenueChartWidget.tsx** - Remove directive
4. **Orders.tsx** - Fix props issue

---

## Expected Result

After these fixes:
- ✅ All 22 TypeScript errors resolved
- ✅ Build will complete successfully
- ✅ No functionality changes - these are all type/import fixes

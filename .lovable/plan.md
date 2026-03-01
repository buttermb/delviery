

# Fix: "Upgrade Required" Showing Despite Enterprise Plan

## Root Cause

In `src/components/tenant-admin/FeatureProtectedRoute.tsx` line 74, the prop name is wrong:

```typescript
// CURRENT (broken) - "feature" is not a valid prop on FeatureGate
return <FeatureGate feature={featureId as unknown as FeatureToggleKey}>{content}</FeatureGate>;

// CORRECT - FeatureGate expects "featureId"
return <FeatureGate featureId={featureId}>{content}</FeatureGate>;
```

The `FeatureGate` component from `@/components/tenant-admin/FeatureGate` accepts `featureId: FeatureId`, not `feature`. Because the prop doesn't match, TypeScript errors out, the build partially fails, and the component renders the "Upgrade Required" fallback.

Your tenant (`big-mike`) has `subscription_plan: enterprise` and `subscription_status: active`, so `canAccess()` should return `true` for every feature once the correct prop is passed.

## Fix

**File: `src/components/tenant-admin/FeatureProtectedRoute.tsx`** -- Line 74

Change:
```typescript
return <FeatureGate feature={featureId as unknown as FeatureToggleKey}>{content}</FeatureGate>;
```
To:
```typescript
return <FeatureGate featureId={featureId}>{content}</FeatureGate>;
```

This removes the broken `as unknown as FeatureToggleKey` cast and passes the `featureId` prop correctly. Since `featureId` is already typed as `FeatureId`, no cast is needed.

## Other Build Errors (batch fix)

Several other TypeScript errors need fixing in the same pass:

1. **`src/App.tsx` lines 168, 250-251** -- `window` possibly undefined + missing `.default` exports. Wrap `window` access in a typeof guard; fix lazy import syntax.
2. **Sidebar files** (SidebarFavorites, SidebarHotItems, SidebarMenuItem, SidebarSection) -- `string` not assignable to `FeatureId`. Cast sidebar item IDs through `as FeatureId`.
3. **`FeatureComparisonTable.tsx`** -- No index signature on FEATURES. Use `FEATURES[key as FeatureId]`.
4. **`VirtualizedTable.tsx` / `VirtualizedTableTanstack.tsx`** -- `unknown` not assignable to `ReactNode`. Cast cell render results.
5. **`src/main.tsx` line 33** -- Same `window` guard needed.

## Impact

All admin panels (Dashboard, Hotbox, Orders, Inventory, Customers, Finance) will load correctly once the prop name is fixed, since the enterprise tier grants access to every feature.

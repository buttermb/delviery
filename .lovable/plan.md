

# Fix `thca_percentage` NOT NULL Constraint Error

## Problem
Line 631 in `ProductManagement.tsx` sets `thca_percentage: null`, but the database column has a NOT NULL constraint — causing every product save to fail.

## Fix
**File**: `src/pages/admin/ProductManagement.tsx` (line 631)

Change:
```typescript
thca_percentage: null,
```
To:
```typescript
thca_percentage: data.thca_percentage ? parseFloat(String(data.thca_percentage)) : 0,
```

This defaults to `0` when no THCa value is provided, matching the existing pattern used elsewhere in the codebase (onboarding, import, migration hooks all default to `0`).

**One file, one line change.**


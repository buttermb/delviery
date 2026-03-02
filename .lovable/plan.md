

# Fix: Stop Re-verification on Every Admin Page Navigation

## Problem

Every time you navigate between pages in the admin panel (e.g., switching tabs in the sidebar), the app shows a loading spinner briefly. This happens because the `TenantAdminProtectedRoute` re-runs its verification logic on every route change.

The verification cache key includes `location.pathname`, so each new page is a cache miss, triggering a full verification cycle (loading spinner, slug check, cache write) on every navigation.

## Root Cause

In `src/components/auth/TenantAdminProtectedRoute.tsx` (line 326), the main verification `useEffect` depends on `location.pathname`. This means:

1. User clicks a sidebar link (e.g., Dashboard to Inventory)
2. `location.pathname` changes
3. Verification effect re-runs with a new `cacheKey` (includes pathname)
4. Cache miss because the new path hasn't been verified before
5. `verifying = true` is set, which shows `LoadingFallback` (line 335)
6. Slug comparison runs (always passes because the tenant slug hasn't changed)
7. `verified = true` and content appears

This creates a visible flash/reload on every single page navigation.

## Fix

### 1. Remove `location.pathname` from verification cache key and effect deps

The verification only checks if the URL's tenant slug matches the authenticated tenant slug. It does NOT depend on which specific admin page you're on. Once `effectiveTenant.slug === tenantSlug` is confirmed, it's valid for ALL pages under that tenant.

**File: `src/components/auth/TenantAdminProtectedRoute.tsx`**

- Change `cacheKey` from `${tenantSlug}-${location.pathname}` to just `${tenantSlug}` (line 199)
- Remove `location.pathname` from the useEffect dependency array (line 326): change from `[tenantSlug, location.pathname, effectiveAdmin, effectiveTenant, effectiveLoading]` to `[tenantSlug, effectiveAdmin, effectiveTenant, effectiveLoading]`
- Remove the `useLocation()` hook import if no longer needed (it's still used for `intendedDestinationUtils.save` in the redirect logic, so keep it but remove from the effect)

### 2. Persist `verified` state across route changes

Currently `verified` resets when the effect re-runs. By removing `location.pathname` from deps, the effect won't re-trigger on navigation, preserving the `verified = true` state.

## Technical Details

The key change is in the verification effect's dependency array:

```
// Before (re-verifies on every page change)
}, [tenantSlug, location.pathname, effectiveAdmin, effectiveTenant, effectiveLoading]);

// After (only re-verifies when tenant or auth changes)  
}, [tenantSlug, effectiveAdmin, effectiveTenant, effectiveLoading]);
```

And the cache key:

```
// Before (cache miss on every new page)
const cacheKey = `${tenantSlug}-${location.pathname}`;

// After (single cache entry per tenant)
const cacheKey = `${tenantSlug}`;
```

## Result

Navigating between admin pages will be instant with no loading spinner flash. Verification only runs once when you first enter the admin panel (or when the tenant context changes).



# Fix: Login Not Redirecting to Admin Page

## Root Cause

After logging in at `/saas/login`, the app navigates to `/{slug}/admin/dashboard`. But the `TenantAdminAuthContext` fails to initialize because it queries a **non-existent column** (`next_billing_date`) from the `tenants` table (line 356). This 400 error means auth never loads, so `TenantAdminProtectedRoute` sees "not authenticated" and redirects back to login -- creating a loop.

## Fixes

### 1. Fix the tenant query in `TenantAdminAuthContext.tsx` (line 356)

Remove `next_billing_date` from the `.select()` call since it doesn't exist in the database. The correct columns are:

```
id, business_name, slug, subscription_plan, subscription_status, trial_ends_at,
grace_period_ends_at, payment_method_added, mrr, onboarding_completed,
business_tier, created_at, is_free_tier, credits_enabled, limits, usage, features
```

### 2. Fix redirect in `TenantAdminProtectedRoute.tsx` (line 371)

Change the unauthenticated redirect from:
```
Navigate to={\`/${redirectSlug}/admin/login\`}
```
to:
```
Navigate to={\`/saas/login?tenant=${redirectSlug}\`}
```

This aligns with the unified login we set up earlier.

### 3. Fix redirect in `TenantAdminProtectedRoute.tsx` (line 421)

The "Return to Login" button in the error UI also points to the old route. Update it to `/saas/login`.

### 4. Fix redirect in `TenantAdminAuthContext.tsx` (line 184)

The `redirectToLoginExpired` function still navigates to `/${slug}/admin/login?expired=1`. Update to `/saas/login?expired=1`.

## Result

After login, the tenant query succeeds, auth context initializes properly, and the user lands on their admin dashboard.



# Fix: Infinite Loading After Login

## Root Cause

The login flow breaks because of a timing issue in `TenantAdminAuthContext`:

1. The auth context's `initializeAuth` runs **once on mount** (empty `[]` deps).
2. When it runs on `/saas/login`, it detects this is NOT a tenant admin route and **returns early** without fetching admin/tenant data -- but marks `authInitializedRef.current = true`.
3. The login page successfully authenticates and stores tokens in localStorage, then navigates to `/{slug}/admin/dashboard`.
4. Since the `TenantAdminAuthProvider` doesn't unmount (it wraps the whole app), `initializeAuth` **never re-runs**. The ref is already `true`.
5. The `onAuthStateChange` listener only syncs tokens, not admin/tenant state.
6. So `admin` and `tenant` remain `null` in React state.
7. `TenantAdminProtectedRoute` sees no auth data and redirects back to `/saas/login`.
8. The login page has no session check, so it just shows the login form again -- infinite loop.

## Fixes

### 1. Add session-aware redirect on LoginPage (`src/pages/saas/LoginPage.tsx`)

Add a `useEffect` that checks for an existing Supabase session on mount. If the user is already authenticated:
- Look up their tenant from `tenant_users`
- Redirect to their admin dashboard automatically

This prevents the login page from just sitting idle when the user is already logged in.

### 2. Re-initialize auth when navigating to admin routes (`src/contexts/TenantAdminAuthContext.tsx`)

The core fix: when the auth context detects it's now on a tenant admin route but has no admin/tenant data loaded, it should re-run the initialization logic even if `authInitializedRef` was previously set.

Specifically, add a secondary `useEffect` that watches `location.pathname`. When the path matches a tenant admin route (`/[slug]/admin/...`) and the auth state has `initialized = true` but `admin` and `tenant` are null, reset `authInitializedRef.current = false` and trigger re-initialization by fetching admin/tenant data from the active Supabase session.

### 3. Login page: also add check for stored auth data

As a belt-and-suspenders approach, the login page should also check localStorage for existing tenant admin tokens on mount. If `TENANT_ADMIN_ACCESS_TOKEN` and `TENANT_DATA` are present, redirect immediately without re-authenticating.

## Technical Details

### File: `src/pages/saas/LoginPage.tsx`
Add a `useEffect` near the top of the component:
- Call `supabase.auth.getSession()`
- If session exists, query `tenant_users` for the user's tenant, then `tenants` for the slug
- Navigate to `/{slug}/admin/dashboard`
- Also check `searchParams.get('expired')` -- if expired=1, don't auto-redirect (let them re-login)

### File: `src/contexts/TenantAdminAuthContext.tsx`
Add a new `useEffect` that watches for route transitions to admin pages:
- Detect when `location.pathname` matches `/[slug]/admin/`
- If `initialized` is true but `admin` is null, fetch from Supabase session
- Query `tenant_users` and `tenants` just like `initializeAuth` does
- Set the admin/tenant/token state accordingly

## Result

After login, the user lands on their admin dashboard. If they somehow get stuck on the login page while authenticated, the page auto-redirects them.


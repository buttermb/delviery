

# Unify Login Pages — Single Tenant Admin Login

## Problem
There are two separate login pages for tenant admins:
- `/saas/login` — modern split-screen design, auto-finds your business by email
- `/:tenantSlug/admin/login` — requires knowing the business slug in the URL

This is confusing. We'll keep **one login page** and redirect the other.

## Plan

### 1. Redirect tenant-slug login to the unified login
Update `App.tsx` so `/:tenantSlug/admin/login` redirects to `/saas/login` instead of rendering a separate page. The slug will be passed as a query parameter so the login page can pre-fill context if needed.

### 2. Update the SaaS Login page
- If a `?tenant=slug` query param is present, show the business name at the top so users know they're logging into the right place
- Keep the existing auto-lookup flow (enter email, it finds your tenant)

### 3. Update all redirect references
Update files that navigate to `/:tenantSlug/admin/login` to instead navigate to `/saas/login`:
- `src/pages/tenant-admin/DashboardPage.tsx` (logout redirect)
- `src/pages/tenant-admin/TrialExpiredPage.tsx` (logout redirect)
- `src/pages/auth/AuthCallbackPage.tsx`
- `src/pages/auth/MFAChallengePage.tsx`
- `src/pages/auth/ForgotPasswordPage.tsx`
- `src/pages/auth/PasswordResetPage.tsx`
- `src/pages/customer/LoginPage.tsx` (link to admin login)
- `src/pages/LoginDirectory.tsx`

### 4. Clean up
The `TenantAdminLoginPage` component stays in the codebase but is no longer routed to directly — all paths go through the unified `/saas/login`.

## Result
One login page at `/saas/login`. Users just enter email and password — the system finds their business automatically. No need to remember a slug URL.

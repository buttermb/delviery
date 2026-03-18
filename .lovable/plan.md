

# Fix: Add `/admin/invoices` Route

## Problem
The user navigates to `/big-mike/admin/invoices` but the route is only defined at `crm/invoices`. There is no `invoices` route at the top level, causing a 404.

## Fix
Add a redirect route in `App.tsx` so that `invoices` redirects to `crm/invoices`, preserving query params (like `?action=create`).

**File: `src/App.tsx`**
- Add a new `<Route>` entry: `<Route path="invoices" element={<Navigate to="crm/invoices" replace />} />`
- Place it near the existing redirect routes (around line 764 area where other redirects like `crm/pre-orders` exist)

This is the same pattern already used for other legacy/shortcut paths in the app.


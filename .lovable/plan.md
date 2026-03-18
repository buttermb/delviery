

# Fix: Infinite Redirect Loop on `/admin/invoices`

## Root Cause

The redirect added in the previous change uses a **relative** path:
```tsx
<Route path="invoices" element={<Navigate to="crm/invoices" replace />} />
```

When the user visits `/big-mike/admin/invoices`, React Router resolves the relative `Navigate to="crm/invoices"` as `/big-mike/admin/invoices/crm/invoices`. This new path matches the `invoices/*` wildcard route, which redirects again to `crm/invoices` (relative), appending yet another `/crm/invoices` — creating an infinite loop.

## Fix

**File: `src/App.tsx` (lines 764-765)**

Change both Navigate targets to use `../crm/invoices` so React Router resolves one level up (to the admin root) before appending `crm/invoices`:

```tsx
<Route path="invoices" element={<Navigate to="../crm/invoices" replace />} />
<Route path="invoices/*" element={<Navigate to="../crm/invoices" replace />} />
```

This ensures `/big-mike/admin/invoices` → `/big-mike/admin/crm/invoices` (the correct destination) without looping.


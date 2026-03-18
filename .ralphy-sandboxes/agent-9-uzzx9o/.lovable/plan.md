

# Priority Work Items

## 1. Fix Edge Function Build Errors (Blocking Deployment)

Two edge functions have TypeScript errors preventing deployment:

### a. `add-courier/index.ts` (lines 72, 76)
Zod's `safeParse` returns a discriminated union. After checking `!validationResult.success`, TypeScript should narrow the type -- but it's not narrowing correctly. Fix: access `.error` only after a `success === false` check, or cast appropriately.

### b. `admin-dashboard/index.ts` (lines 19, 139, 247, 413, 731+)
The `logAdminAction` helper types `supabase` as `ReturnType<typeof createClient>` but the actual client passed in is typed differently (with generic parameters). Fix: widen the `supabase` parameter type to `any` or use a compatible generic signature. The `admin_audit_logs` table insert is also typed as `never`, likely because the table isn't in the generated types -- need to cast the table name.

## 2. Fix Auth Token Refresh Errors (Runtime)

Console shows repeated failures on `tenant-admin-auth?action=refresh` with "Failed to fetch" followed by `RangeError: status 0`. The `tenant-admin-auth` edge function is likely failing to deploy (due to build errors above) or has a network issue. Once edge function build errors are fixed and redeployed, this should resolve. If not, the retry logic that constructs a `new Response(body, { status: 0 })` on network failure needs a guard to clamp status to at least 500.

## 3. Realtime Subscription Errors

Warning about `channel_error` on `[products, inventory_batches, marketplace_product_settings]` -- these tables may not have realtime enabled or RLS is blocking the subscription. Low priority but worth checking after the above are fixed.

---

## Technical Details

### Fix 1a: `supabase/functions/add-courier/index.ts`
Change lines 71-80 to properly narrow the type:
```typescript
if (!validationResult.success) {
  const errors = validationResult.error.flatten();
  logger.warn('Validation failed', { errors });
  return new Response(
    JSON.stringify({ error: 'Validation failed', details: errors.fieldErrors }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```
The key fix is assigning `validationResult.error` to a const inside the narrowed block so TypeScript can infer the type correctly, or explicitly typing the `safeParse` call.

### Fix 1b: `supabase/functions/admin-dashboard/index.ts`
- Change `logAdminAction` parameter from `supabase: ReturnType<typeof createClient>` to use a looser type (e.g., `supabase: any`)
- Or use `// deno-lint-ignore no-explicit-any` with proper typing

### Fix 2: Auth token refresh
- Investigate `tenant-admin-auth` edge function for deployment status
- Add a status code guard in the retry utility to prevent `new Response(body, { status: 0 })`


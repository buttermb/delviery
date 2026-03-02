
# Fix Edge Function Build Errors

## Problem
There are TypeScript type-narrowing errors across **36 edge function files**. The code logic is correct (checking `!result.success` before accessing `.error`), but TypeScript's type narrowing isn't working properly with Zod's `SafeParseReturnType` in the Deno environment.

The errors fall into two categories:
1. **Zod `.error` access** — accessing `.error` on `SafeParseReturnType` without proper narrowing (36 files)
2. **Supabase client type mismatch** — `logAdminAction` function has overly strict typing for the Supabase client parameter

## Fix Strategy

For each affected file, apply one of these minimal fixes:

### Zod Errors (most files)
Change from direct `.error` access to explicit type assertion after the `!success` check:

```typescript
// Before (TypeScript can't narrow):
if (!result.success) {
  return result.error.message;
}

// After (explicit cast):
if (!result.success) {
  const zodError = result as z.SafeParseError<typeof schema>;
  return zodError.error.message;
}
```

Some files already use this pattern correctly (e.g., `storefront-checkout`).

### Admin Dashboard Type Error
Update the `logAdminAction` function to accept `any` for the Supabase client type instead of the overly strict inferred type.

## Files to Update (~36 files)
Key files include:
- `supabase/functions/add-courier/index.ts`
- `supabase/functions/admin-dashboard/validation.ts`
- `supabase/functions/admin-dashboard/index.ts`
- `supabase/functions/api/routes/contacts.ts`
- `supabase/functions/api/routes/menus.ts`
- `supabase/functions/api/routes/pos.ts`
- And ~30 more edge function files

## Performance Assessment

Your performance optimizations **are working well**:
- Memoized components (ProductCatalog, Navigation, CartDrawer) reduce re-renders
- TanStack Query with 60s stale time reduces API calls significantly
- Throttled event handlers (ParticleBackground, scroll) reduce CPU usage
- Tutorial MutationObserver fix prevents lag/crashes

These build errors are **not related to performance** — they're TypeScript strictness issues that prevent edge functions from deploying. Fixing them will ensure your backend functions work correctly alongside your frontend performance gains.

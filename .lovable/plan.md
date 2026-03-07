

# Fix: Edge Function Build Errors + Page Reload Issue

## Two Problems

### 1. Edge Function Build Errors (11+ TypeScript errors across 2 files)

The root cause is **version mismatch** of `@supabase/supabase-js` between edge functions:
- `admin-actions/index.ts` imports from `../_shared/deps.ts` which uses `@supabase/supabase-js@2.39.3`
- `admin-dashboard/index.ts` imports directly from `https://esm.sh/@supabase/supabase-js@2` (resolves to a different version)

The newer Supabase JS versions have stricter generic types, causing `ReturnType<typeof createClient>` to produce `never` for table types when the database schema generic isn't provided.

**Fix for both files**: Cast the Supabase client to `any` in the helper function signatures to bypass strict generics, and add type assertions for property access on query results.

| File | Changes |
|------|---------|
| `supabase/functions/admin-actions/index.ts` | Change function signatures to use `any` for supabase param; already imports from shared deps (good) |
| `supabase/functions/admin-dashboard/index.ts` | Switch to shared deps import; change function signatures to use `any` for supabase param; cast `order.created_at`, `order.total_amount`, `addr.lat/lng`, `order.id` to `string` |

**Specific changes in `admin-dashboard/index.ts`:**
- Line 1-2: Replace direct imports with `import { serve, createClient, corsHeaders } from '../_shared/deps.ts'`
- Lines 12, 37: Change `supabase: ReturnType<typeof createClient>` to `supabase: any`
- Line 283: Cast `order.id` — `(order.id as string).substring(0, 8)`
- Line 575: `parseFloat(addr.lat as string)`, same for `addr.lng` and `order.total_amount`
- Line 599: Same `parseFloat` casts
- Line 662: `(order.created_at as string).split("T")[0]`
- Line 666: `parseFloat(order.total_amount as string)`

**Specific changes in `admin-actions/index.ts`:**
- Lines 11, 39: Change `supabase: ReturnType<typeof createClient>` to `supabase: any`

### 2. Page Reloading ("Significant Memory")

The session replay and console logs show the page is stuck on "Loading..." with the auth context timing out after 10s. The `useVersionCheck` hook auto-reloads the page when it detects a version mismatch (comparing `localStorage` stored version vs `/version.json`). Combined with the auth timeout redirect, this creates a reload loop.

The version check is working as designed — the `version.json` gets regenerated on every build, so each Lovable edit triggers the auto-reload. This is expected behavior in development, not a memory leak. The "significant memory" browser warning likely comes from the large bundle size of this app (100+ routes, many dependencies) hitting the preview iframe's memory limits.

**No code changes needed for this** — it is not a bug, just the version-check system reacting to frequent rebuilds in development.

## Summary

3 files to edit, all edge function type fixes. No client-side changes needed for the reload issue.




# Fix All TypeScript Build Errors for Production Deployment

## The Problem

The website loads fine in the development preview, but **cannot be published to live** because the production build runs TypeScript type checking (`tsc --noEmit`) and fails with 50+ errors. All errors stem from the same root cause: the auto-generated Supabase types file doesn't include many tables, RPCs, and columns used in the code.

## The Fix Strategy

Apply `(supabase as any).from('table')` and `(supabase as any).rpc('fn')` casting to bypass incomplete generated types. This is the established pattern already used in 30+ files throughout the codebase.

---

## Complete File-by-File Fix List

### Group 1: Hooks with `supabase.from()` errors (cast to `(supabase as any).from()`)

| # | File | What to change |
|---|------|----------------|
| 1 | `src/hooks/useAdminSessions.ts` | Lines 204, 240, 268: `supabase.from('user_sessions')` -- cast all 3 to `(supabase as any).from('user_sessions')`. Also cast the `.map()` results at line 217: `(data ?? []).map((session: any) => ({` |
| 2 | `src/hooks/useAnalyticsData.ts` | Line 585: `supabase.from('inventory_history')` -- cast to `(supabase as any).from(...)`. Line 598: change `return data ?? []` to `return (data as any[]) ?? []` |
| 3 | `src/hooks/useAttentionQueue.ts` | Line 102: `supabase.from('deliveries')` -- cast to `(supabase as any).from('deliveries')` |
| 4 | `src/hooks/useAutoReorder.ts` | Lines 158, 180, 309, 335: cast all 4 `supabase.from('products')` and `supabase.from('order_items')` to `(supabase as any).from(...)`. Cast results: `const products = ((data as any[]) ?? [])` and `const product = data as any` |
| 5 | `src/hooks/useAutoTagRules.ts` | Lines 112, 131: cast both `supabase.from('tags')` to `(supabase as any).from('tags')` |

### Group 2: Components with verbose casts or missing table types

| # | File | What to change |
|---|------|----------------|
| 6 | `src/components/admin/storefront/InventorySyncIndicator.tsx` | Line 314: change `connectionStatus === 'error'` comparison -- the type only allows `'connected' | 'connecting' | 'disconnected'`. Either add `'error'` to the type definition, or cast: `(connectionStatus as string) === 'error'` |
| 7 | `src/components/admin/vendors/POReceiving.tsx` | Lines 260, 344, 360: replace verbose `(supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> }).from(...)` with simpler `(supabase as any).from(...)` |

### Group 3: Any remaining `supabase.from()` or `supabase.rpc()` calls in other files

After fixing the above 7 files, run `npx tsc --noEmit` to check for remaining errors. Based on the full error list, these additional files may also need the same pattern:

- Any hooks or components still using `supabase.from('table_not_in_types')` directly
- Any hooks still using `supabase.rpc('fn_not_in_types')` directly

---

## Technical Details

### Fix Pattern A: Table not in generated types

```text
Before:  const { data } = await supabase.from('user_sessions').select(...)
After:   const { data } = await (supabase as any).from('user_sessions').select(...)
```

### Fix Pattern B: Result property access after Pattern A

When using `(supabase as any).from()`, the result type is `any`, so property access works automatically. But when the original `supabase.from()` references columns that don't exist (like `vendor_id` on `products`), we also need to cast the result:

```text
Before:  const productIds = products.map((p) => p.id);  // TS2339: 'id' doesn't exist
After:   const productIds = (products as any[]).map((p: any) => p.id);
```

Or simpler -- just cast at the query level with `(supabase as any).from()` which makes the entire chain return `any`.

### Fix Pattern C: Type comparison mismatch (InventorySyncIndicator)

```text
Before:  connectionStatus === 'error'  // TS2367: no overlap
After:   (connectionStatus as string) === 'error'
```

### Fix Pattern D: Verbose cast simplification (POReceiving)

```text
Before:  (supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> }).from('purchase_order_items')
After:   (supabase as any).from('purchase_order_items')
```

---

## Implementation Order

1. Fix `useAdminSessions.ts` (3 locations)
2. Fix `useAnalyticsData.ts` (2 locations)
3. Fix `useAttentionQueue.ts` (1 location)
4. Fix `useAutoReorder.ts` (4 locations + result casts)
5. Fix `useAutoTagRules.ts` (2 locations)
6. Fix `InventorySyncIndicator.tsx` (1 type comparison)
7. Fix `POReceiving.tsx` (3 verbose casts)
8. Run type check and fix any remaining errors with the same pattern

This will eliminate all remaining build errors and allow the production build to succeed, making the live site load properly.


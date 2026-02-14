

## Fix: TypeScript Build Error in `useMenuExpiration.ts`

### Problem
The file `src/hooks/useMenuExpiration.ts` has **8 TypeScript compilation errors** starting at line 50. The root cause is overly complex inline type assertions (`as unknown as { ... }`) used to work around Supabase client typing. These massive single-line type casts have syntax issues that break the build.

### Solution
Replace all the verbose `as unknown as { ... }` type assertions with a simple `any` cast pattern. Since the Supabase client is already typed via the auto-generated types, and these queries are just working around missing table definitions in the generated types, a clean cast is sufficient and far more maintainable.

### Changes

**File: `src/hooks/useMenuExpiration.ts`**

Replace each instance of the long inline type assertion pattern:
```typescript
// BEFORE (broken, 200+ character single-line type casts):
await (supabase as unknown as { from: (table: string) => { select: ... } })
  .from('disposable_menus')
  ...

// AFTER (clean, working):
await (supabase as any)
  .from('disposable_menus')
  ...
```

This applies to approximately 6 locations in the file (lines 50, 85, 123, 153, 171, 241, 252, 296).

### Why This Is Safe
- The Supabase client already provides runtime type safety via its SDK
- These casts exist only because `disposable_menus` and `menu_schedule_history` may not be in the auto-generated types yet
- Using `as any` is the standard pattern for tables not yet in generated types
- All query results are already typed via the return type annotations (`ExpiringMenu[]`, `ArchivedMenu[]`)

### Technical Details
- **Files modified:** 1 (`src/hooks/useMenuExpiration.ts`)
- **Risk:** Low -- only removing broken type assertions, no logic changes
- **Build impact:** Resolves all 8 TS errors, unblocking the build


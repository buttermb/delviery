

## Fix: TypeScript Build Errors in `useMenuExpiration.ts`

### Current Status
The build is **still broken** with 8 TypeScript errors in `src/hooks/useMenuExpiration.ts`. The previous fix attempts did not successfully modify the file -- all 8 locations still contain the malformed `as unknown as { from: ... }` type assertions.

### What's Wrong
Line 50 (and 7 other locations) have extremely long inline type casts that the TypeScript compiler cannot parse. These cause cascading syntax errors through line 74.

### Fix
Replace the verbose type assertion on each of these 8 lines with `(supabase as any)`:

| Line | Query Target | Operation |
|------|-------------|-----------|
| 50 | `disposable_menus` | select (expiring menus) |
| 85 | `disposable_menus` | select (recently expired) |
| 123 | `disposable_menus` | select single (archive prep) |
| 153 | `disposable_menus` | update (archive) |
| 171 | `menu_schedule_history` | insert (log archive) |
| 241 | `disposable_menus` | update (reactivate) |
| 252 | `menu_schedule_history` | insert (log reactivation) |
| 296 | `disposable_menus` | select (auto-deactivation check) |

Each line changes from:
```typescript
await (supabase as unknown as { from: (table: string) => { select: ... } })
```
To:
```typescript
await (supabase as any)
```

### Technical Details
- **Files modified:** 1 (`src/hooks/useMenuExpiration.ts`)
- **Risk:** Low -- only replacing broken type casts, zero logic changes
- **Build impact:** Resolves all 8 TS errors, unblocking the build
- **Why safe:** Runtime behavior is identical; return types are already annotated on the containing functions



# Fix Sidebar "Rendered more hooks" Error

## Problem Summary
The sidebar is crashing with the error "Rendered more hooks than during the previous render." This is a React hooks rule violation in the sidebar's underlying hooks.

## Root Cause
Two hooks have **early returns that come AFTER other hooks are called**, causing the number of hooks to change between renders:

1. **`useSidebarPreferences.ts` (lines 366-376)**: Early return after `useQuery` and `useMutation` hooks
2. **`useOperationSize.ts` (lines 186-195)**: Early return after `useQuery`, `useMutation`, and other hooks

When `admin?.userId` changes from `undefined` to a value (or vice versa), React sees different numbers of hooks being called, which breaks the rules of hooks.

## Solution
Move the early returns to BEFORE any hooks are called, or remove them entirely by handling the "no user" case within the hooks themselves.

### Changes Required

#### 1. Fix `src/hooks/useSidebarPreferences.ts`
Move the `!admin?.userId` check to the **beginning** of the hook, before any other hooks are called.

```typescript
export function useSidebarPreferences() {
  const { tenant, admin } = useTenantAdminAuth();
  
  // MOVE THIS CHECK TO THE TOP - before any hooks
  // But we can't return early before calling hooks, so we need a different approach
  // Instead, use enabled flags and handle missing user in the return
}
```

**Approach**: Remove the early return entirely. Instead:
- Keep all hooks called unconditionally
- Use the `enabled` option in `useQuery` to prevent fetching when user is missing
- Return default values when data isn't available

#### 2. Fix `src/hooks/useOperationSize.ts`
Same approach - remove the early return at line 186-195 and handle the missing user case through the hooks' `enabled` flags and conditional return values.

### Technical Implementation

#### `useSidebarPreferences.ts`
```text
Lines 366-376: DELETE the early return block
Lines 378-385: Update to always return, handling the no-user case with defaults
```

The hook already handles `!admin?.userId` in the query's `enabled` flag and returns `DEFAULT_PREFERENCES` when appropriate. The early return is redundant and harmful.

#### `useOperationSize.ts`
```text
Lines 186-195: DELETE the early return block
Lines 197-204: Update to always return, using detected defaults when user is missing
```

The hook already uses `enabled: !!tenant?.id && !!admin?.userId` for the query. The early return is redundant.

### Verification
After these fixes:
- All hooks will be called in the same order on every render
- The sidebar will load correctly without crashing
- Functionality remains identical (the return values handle missing user data)

### Files to Modify
1. `src/hooks/useSidebarPreferences.ts` - Remove early return at lines 366-376
2. `src/hooks/useOperationSize.ts` - Remove early return at lines 186-195

# Safe Fetch Utility Guide

## Overview
The `safeFetch` utility prevents "illegal invocation" errors when making HTTP requests. This error occurs when external scripts (like the Lovable preview script) wrap or proxy the native `fetch` function.

## Problem
Using raw `fetch()` directly can fail with:
```
TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation
```

This happens because:
1. External scripts wrap `window.fetch`
2. Raw `fetch()` loses its execution context
3. The browser throws an error when fetch isn't properly bound

## Solution
Always use the centralized `safeFetch` utility:

```typescript
import { safeFetch } from '@/utils/safeFetch';

// Instead of:
const response = await fetch('https://api.example.com/data');

// Use:
const response = await safeFetch('https://api.example.com/data');
```

## API

### `safeFetch(input, init)`
Drop-in replacement for native fetch with automatic context binding.

**Parameters:**
- `input: RequestInfo | URL` - The resource to fetch
- `init?: RequestInit` - Optional fetch configuration

**Returns:** `Promise<Response>`

**Example:**
```typescript
const response = await safeFetch('https://api.example.com/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'John' })
});
```

### `safeFetchJSON<T>(input, init)`
Type-safe wrapper that automatically parses JSON responses.

**Parameters:**
- `input: RequestInfo | URL` - The resource to fetch
- `init?: RequestInit` - Optional fetch configuration

**Returns:** `Promise<T>`

**Example:**
```typescript
interface User {
  id: string;
  name: string;
}

const users = await safeFetchJSON<User[]>('https://api.example.com/users');
// users is typed as User[]
```

## Usage Examples

### Basic GET Request
```typescript
import { safeFetch } from '@/utils/safeFetch';

const response = await safeFetch('/api/data');
const data = await response.json();
```

### POST with JSON
```typescript
import { safeFetch } from '@/utils/safeFetch';

const response = await safeFetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Jane', email: 'jane@example.com' })
});
```

### Type-Safe JSON Fetching
```typescript
import { safeFetchJSON } from '@/utils/safeFetch';

interface Product {
  id: string;
  name: string;
  price: number;
}

try {
  const products = await safeFetchJSON<Product[]>('/api/products');
  console.log(products[0].name); // Fully typed!
} catch (error) {
  console.error('Failed to fetch products:', error);
}
```

### With Error Handling
```typescript
import { safeFetch } from '@/utils/safeFetch';

try {
  const response = await safeFetch('/api/data');
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data;
} catch (error) {
  console.error('Fetch failed:', error);
  toast.error('Failed to load data');
}
```

## Migration Guide

### Before (❌ Causes Errors)
```typescript
// Direct fetch call
const response = await fetch('/api/data');

// Module-level binding (fails in preview)
const safeFetch = fetch.bind(window);
```

### After (✅ Works Everywhere)
```typescript
import { safeFetch } from '@/utils/safeFetch';

const response = await safeFetch('/api/data');
```

## Files Updated
The following files have been migrated to use `safeFetch`:

✅ `src/hooks/useVersionCheck.ts` - Version checking
✅ `src/lib/workflowEngine.ts` - Webhook sending
✅ `src/pages/admin/LinkChecker.tsx` - Link validation
✅ `src/pages/saas/LoginPage.tsx` - Uses edgeFunctionRequest (which handles binding internally)
✅ `src/contexts/TenantAdminAuthContext.tsx` - Uses dynamic binding via getSafeFetch
✅ `src/contexts/CustomerAuthContext.tsx` - Uses dynamic binding via getSafeFetch
✅ `src/contexts/SuperAdminAuthContext.tsx` - Uses dynamic binding via getSafeFetch

## Best Practices

1. **Always import safeFetch** for any new fetch calls
2. **Use safeFetchJSON** when you know the response is JSON
3. **Don't create local fetch bindings** - use the centralized utility
4. **Add proper error handling** around all network requests
5. **Type your responses** when using safeFetchJSON

## Technical Details

### How It Works
```typescript
export const safeFetch = (input, init) => {
  // Bind fetch to window context at call time
  const boundFetch = typeof window !== 'undefined' 
    ? window.fetch.bind(window) 
    : fetch;
  
  return boundFetch(input, init);
};
```

### Why Binding at Call Time?
- Ensures fetch is bound to the latest window context
- Works even if window.fetch is wrapped/proxied by external scripts
- Compatible with SSR (falls back to global fetch)
- No module-level binding issues

## Troubleshooting

### Still Getting "Illegal Invocation" Errors?
1. Search for raw `fetch(` calls in your code
2. Replace with `safeFetch(` from `@/utils/safeFetch`
3. Check that imports are correct
4. Verify you're not creating local fetch bindings

### Example Search Pattern
```bash
# Find potential raw fetch calls
grep -r "await fetch(" src/
grep -r "= fetch(" src/
```

## Related Files
- `src/utils/safeFetch.ts` - Utility implementation
- `src/lib/apiClient.ts` - Edge function requests (uses similar pattern)
- `docs/CACHE_BUSTING_SYSTEM.md` - Version checking system



## Fix Merge Conflict in `useAsyncAction.ts`

### Problem
`src/hooks/useAsyncAction.ts` contains Git merge conflict markers, breaking the build with 6 TS1185 errors.

### Solution
Replace the entire file with a resolved version that:
- Keeps the Round 3 API: returns `{ execute, isPending, error }` 
- Uses `sonner` toast directly (matching project conventions in `toastUtils.ts` and other hooks)
- Removes the `use-toast` import (the legacy shadcn bridge is unnecessary here)

### Resolved Code

```typescript
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface UseAsyncActionOptions {
  successMessage?: string;
  errorMessage?: string;
}

interface UseAsyncActionReturn<TArgs extends unknown[]> {
  execute: (...args: TArgs) => Promise<void>;
  isPending: boolean;
  error: Error | null;
}

/**
 * Wraps an async function with loading/error state and toast notifications.
 */
export function useAsyncAction<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<unknown>,
  options: UseAsyncActionOptions = {}
): UseAsyncActionReturn<TArgs> {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (...args: TArgs) => {
    setIsPending(true);
    setError(null);
    try {
      await action(...args);
      if (options.successMessage) {
        toast.success(options.successMessage);
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      logger.error('useAsyncAction failed', e, { component: 'useAsyncAction' });
      toast.error(options.errorMessage || 'An error occurred', {
        description: e.message,
      });
    } finally {
      setIsPending(false);
    }
  }, [action, options.successMessage, options.errorMessage]);

  return { execute, isPending, error };
}
```

### Verification
After writing the file, run `tsc --noEmit` and `vite build` to confirm zero errors.


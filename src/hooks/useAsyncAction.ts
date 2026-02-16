import { useState, useCallback } from 'react';

import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();

  const execute = useCallback(async (...args: TArgs) => {
    setIsPending(true);
    setError(null);
    try {
      await action(...args);
      if (options.successMessage) {
        toast({ title: options.successMessage });
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      logger.error('useAsyncAction failed', e, { component: 'useAsyncAction' });
      toast({
        title: options.errorMessage || 'An error occurred',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setIsPending(false);
    }
  }, [action, options.successMessage, options.errorMessage, toast]);

  return { execute, isPending, error };
}

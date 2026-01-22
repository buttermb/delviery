import { useState, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';

interface SubmitGuardOptions {
  /** Minimum time between submissions in ms */
  debounceMs?: number;
  /** Generate idempotency key for request */
  useIdempotencyKey?: boolean;
}

interface SubmitGuardResult<T> {
  /** Whether a submission is in progress */
  isSubmitting: boolean;
  /** Wrap your submit handler with this */
  guardedSubmit: (handler: () => Promise<T>) => Promise<T | null>;
  /** Current idempotency key (if enabled) */
  idempotencyKey: string | null;
  /** Reset state after submission */
  reset: () => void;
}

/**
 * Hook to prevent duplicate form submissions
 * 
 * @example
 * ```tsx
 * const { isSubmitting, guardedSubmit } = useSubmitGuard();
 * 
 * const handleSubmit = async (data) => {
 *   await guardedSubmit(async () => {
 *     await api.createOrder(data);
 *   });
 * };
 * 
 * <Button disabled={isSubmitting}>
 *   {isSubmitting ? 'Saving...' : 'Save'}
 * </Button>
 * ```
 */
export function useSubmitGuard<T = void>(
  options: SubmitGuardOptions = {}
): SubmitGuardResult<T> {
  const { debounceMs = 500, useIdempotencyKey = false } = options;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastSubmitRef = useRef<number>(0);
  const idempotencyKeyRef = useRef<string | null>(
    useIdempotencyKey ? generateIdempotencyKey() : null
  );

  const guardedSubmit = useCallback(
    async (handler: () => Promise<T>): Promise<T | null> => {
      const now = Date.now();

      // Already submitting - ignore
      if (isSubmitting) {
        logger.debug('[SubmitGuard] Submission blocked - already in progress');
        return null;
      }

      // Too soon after last submission - debounce
      if (now - lastSubmitRef.current < debounceMs) {
        logger.debug('[SubmitGuard] Submission blocked - debounce');
        return null;
      }

      setIsSubmitting(true);
      lastSubmitRef.current = now;

      try {
        const result = await handler();
        
        // Generate new idempotency key for next submission
        if (useIdempotencyKey) {
          idempotencyKeyRef.current = generateIdempotencyKey();
        }

        return result;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, debounceMs, useIdempotencyKey]
  );

  const reset = useCallback(() => {
    setIsSubmitting(false);
    lastSubmitRef.current = 0;
    if (useIdempotencyKey) {
      idempotencyKeyRef.current = generateIdempotencyKey();
    }
  }, [useIdempotencyKey]);

  return {
    isSubmitting,
    guardedSubmit,
    idempotencyKey: idempotencyKeyRef.current,
    reset,
  };
}

/**
 * Generate a unique idempotency key for a request
 */
function generateIdempotencyKey(): string {
  // Use timestamp + random for uniqueness
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Get headers with idempotency key
 */
export function getIdempotencyHeaders(key: string): Record<string, string> {
  return {
    'Idempotency-Key': key,
  };
}

export default useSubmitGuard;

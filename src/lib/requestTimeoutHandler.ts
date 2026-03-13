import { logger } from '@/lib/logger';
import { toast } from 'sonner';

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

interface RequestWithTimeoutOptions {
  timeoutMs?: number;
  onTimeout?: () => void;
  showToast?: boolean;
}

/**
 * Wrap a promise with a timeout.
 * If the promise doesn't resolve within the timeout period, it will be rejected.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  options: RequestWithTimeoutOptions = {}
): Promise<T> {
  const { timeoutMs = 30000, onTimeout, showToast = true } = options;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new TimeoutError(`Request timed out after ${timeoutMs}ms`);
      logger.error('[RequestTimeout] Request timed out', { timeoutMs });

      if (showToast) {
        toast.error('Request timed out', {
          description: 'The server took too long to respond. Please try again.',
        });
      }

      if (onTimeout) {
        onTimeout();
      }

      reject(error);
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Retry a request with exponential backoff.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelayMs = 1000, maxDelayMs = 10000, timeoutMs = 30000 } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      logger.info('[RequestRetry] Attempt', { attempt: attempt + 1, maxRetries });

      const result = await withTimeout(fn(), { timeoutMs, showToast: attempt === maxRetries - 1 });
      return result;
    } catch (error) {
      lastError = error as Error;
      logger.warn('[RequestRetry] Attempt failed', { attempt: attempt + 1, error });

      // Don't wait after the last attempt
      if (attempt < maxRetries - 1) {
        const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
        logger.info('[RequestRetry] Waiting before retry', { delayMs: delay });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logger.error('[RequestRetry] All attempts failed', { maxRetries });
  throw lastError ?? new Error('Request failed after retries');
}

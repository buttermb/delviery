/**
 * Network Error Handler with Retry Logic
 * Provides standardized error handling and retry functionality
 */

import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  retryableErrors?: string[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableErrors: ['network', 'timeout', '500', '502', '503', '504'],
};

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown, retryableErrors: string[]): boolean {
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some((retryable) =>
      errorMessage.includes(retryable.toLowerCase())
    );
  }
  return false;
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
      return 'Network connection failed. Please check your internet connection.';
    }
    if (message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    if (message.includes('401') || message.includes('unauthorized')) {
      return 'Your session has expired. Please log in again.';
    }
    if (message.includes('403') || message.includes('forbidden')) {
      return 'You do not have permission to perform this action.';
    }
    if (message.includes('404')) {
      return 'The requested resource was not found.';
    }
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return 'Server error. Please try again in a moment.';
    }

    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Execute function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  context?: { component?: string; action?: string }
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Log error
      logger.error('Operation failed', error, {
        component: context?.component || 'networkErrorHandler',
        action: context?.action,
        attempt: attempt + 1,
        maxRetries: opts.maxRetries,
      });

      // Check if error is retryable
      if (attempt < opts.maxRetries && isRetryableError(error, opts.retryableErrors)) {
        const delay = opts.retryDelay * Math.pow(2, attempt); // Exponential backoff
        logger.debug(`Retrying in ${delay}ms (attempt ${attempt + 1}/${opts.maxRetries})`, {
          component: context?.component || 'networkErrorHandler',
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Not retryable or max retries reached
      break;
    }
  }

  // All retries failed
  const userMessage = getUserFriendlyMessage(lastError);
  
  // Show error toast with retry option
  toast.error(userMessage, {
    description: lastError instanceof Error ? lastError.message : undefined,
    action: {
      label: 'Retry',
      onClick: () => {
        // Retry one more time
        return withRetry(fn, { ...opts, maxRetries: 1 }, context);
      },
    },
    duration: 5000,
  });

  throw lastError;
}

/**
 * Handle network error with user-friendly message
 */
export function handleNetworkError(
  error: unknown,
  context?: { component?: string; action?: string }
): void {
  const userMessage = getUserFriendlyMessage(error);
  
  logger.error('Network error', error, context);
  
  toast.error(userMessage, {
    description: error instanceof Error ? error.message : undefined,
    duration: 5000,
  });
}

/**
 * Check if device is online
 */
export function isOnline(): boolean {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return true; // Assume online if can't determine
}

/**
 * Queue action for when device comes back online
 */
const offlineQueue: Array<() => Promise<void>> = [];

export function queueOfflineAction(action: () => Promise<void>): void {
  offlineQueue.push(action);
  
  // Show notification
  toast.info('Action queued', {
    description: 'This action will be completed when you are back online.',
    duration: 3000,
  });

  // Process queue when online
  if (isOnline()) {
    processOfflineQueue();
  } else {
    // Listen for online event
    window.addEventListener('online', processOfflineQueue, { once: true });
  }
}

async function processOfflineQueue(): Promise<void> {
  while (offlineQueue.length > 0) {
    const action = offlineQueue.shift();
    if (action) {
      try {
        await action();
        toast.success('Queued action completed', { duration: 3000 });
      } catch (error) {
        logger.error('Failed to process queued action', error);
        toast.error('Failed to complete queued action', { duration: 3000 });
      }
    }
  }
}

/**
 * Monitor online/offline status
 */
export function setupOfflineMonitor(
  onOnline?: () => void,
  onOffline?: () => void
): () => void {
  const handleOnline = () => {
    logger.info('Device came online', { component: 'networkErrorHandler' });
    processOfflineQueue();
    onOnline?.();
    toast.success('You are back online', { duration: 3000 });
  };

  const handleOffline = () => {
    logger.warn('Device went offline', undefined, { component: 'networkErrorHandler' });
    onOffline?.();
    toast.warning('You are offline. Some features may not work.', { duration: 5000 });
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}


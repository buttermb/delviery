/**
 * Auth Offline Hook
 * Detects navigator.onLine, queues login attempts when offline,
 * syncs auth state when back online, and prevents form submission when offline.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

interface QueuedAuthAttempt {
  email: string;
  password: string;
  tenantSlug?: string;
  timestamp: number;
}

interface UseAuthOfflineReturn {
  isOnline: boolean;
  hasQueuedAttempt: boolean;
  queuedAttempt: QueuedAuthAttempt | null;
  queueLoginAttempt: (email: string, password: string, tenantSlug?: string) => void;
  clearQueuedAttempt: () => void;
  preventSubmit: (e: React.FormEvent) => boolean;
}

/**
 * Hook for managing offline state in auth flows.
 * Detects online/offline, queues login attempts, and auto-retries when back online.
 *
 * @param onRetryLogin - Callback to execute queued login when back online
 * @returns Offline state and queue management functions
 *
 * @example
 * ```tsx
 * const { isOnline, preventSubmit } = useAuthOffline(async (email, password, slug) => {
 *   await login(email, password, slug);
 * });
 *
 * const handleSubmit = (e: React.FormEvent) => {
 *   if (preventSubmit(e)) return;
 *   // proceed with login
 * };
 * ```
 */
export function useAuthOffline(
  onRetryLogin?: (email: string, password: string, tenantSlug?: string) => Promise<void>
): UseAuthOfflineReturn {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [queuedAttempt, setQueuedAttempt] = useState<QueuedAuthAttempt | null>(null);
  const onRetryLoginRef = useRef(onRetryLogin);
  onRetryLoginRef.current = onRetryLogin;

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      logger.info('Auth: Network connection restored');
      toast.success('Your connection has been restored.');
    };

    const handleOffline = () => {
      setIsOnline(false);
      logger.warn('Auth: Network connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-retry queued login attempt when back online
  useEffect(() => {
    if (isOnline && queuedAttempt && onRetryLoginRef.current) {
      const { email, password, tenantSlug } = queuedAttempt;
      logger.info('Auth: Retrying queued login attempt');
      toast.info('Connection restored. Attempting to sign in.');

      onRetryLoginRef.current(email, password, tenantSlug)
        .then(() => {
          setQueuedAttempt(null);
        })
        .catch((error: unknown) => {
          logger.error('Auth: Queued login retry failed', error);
          setQueuedAttempt(null);
          toast.error(error instanceof Error ? error.message : 'Please try again.');
        });
    }
  }, [isOnline, queuedAttempt]);

  const queueLoginAttempt = useCallback((email: string, password: string, tenantSlug?: string) => {
    const attempt: QueuedAuthAttempt = {
      email,
      password,
      tenantSlug,
      timestamp: Date.now(),
    };
    setQueuedAttempt(attempt);
    logger.info('Auth: Login attempt queued for when connection restores');
    toast.info('Your login will be attempted when the connection is restored.');
  }, []);

  const clearQueuedAttempt = useCallback(() => {
    setQueuedAttempt(null);
  }, []);

  const preventSubmit = useCallback((e: React.FormEvent): boolean => {
    if (!isOnline) {
      e.preventDefault();
      toast.error('Please check your internet connection and try again.');
      return true;
    }
    return false;
  }, [isOnline]);

  return {
    isOnline,
    hasQueuedAttempt: queuedAttempt !== null,
    queuedAttempt,
    queueLoginAttempt,
    clearQueuedAttempt,
    preventSubmit,
  };
}

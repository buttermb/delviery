/**
 * Cleanup Hook
 * Automatically clean up subscriptions, intervals, and event listeners
 */

import { useEffect, useRef } from 'react';

interface CleanupItem {
  type: 'subscription' | 'interval' | 'timeout' | 'listener';
  cleanup: () => void;
}

/**
 * Hook to manage cleanup of resources
 * Automatically cleans up on unmount
 */
export function useCleanup() {
  const cleanupItems = useRef<CleanupItem[]>([]);

  const addCleanup = (
    type: CleanupItem['type'],
    cleanup: () => void
  ) => {
    cleanupItems.current.push({ type, cleanup });
  };

  const cleanup = () => {
    cleanupItems.current.forEach(({ cleanup: cleanupFn }) => {
      try {
        cleanupFn();
      } catch (error) {
        // Use logger in production, silent in dev for cleanup errors
        if (import.meta.env.DEV) {
           
          console.warn('Cleanup error:', error);
        }
      }
    });
    cleanupItems.current = [];
  };

  useEffect(() => {
    return cleanup;
  }, []);

  return { addCleanup, cleanup };
}

/**
 * Hook to clean up a subscription
 * @param subscription - Subscription object with unsubscribe method
 */
export function useSubscriptionCleanup<T extends { unsubscribe: () => void }>(
  subscription: T | null | undefined
) {
  useEffect(() => {
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [subscription]);
}

/**
 * Hook to clean up an interval
 * @param intervalId - Interval ID from setInterval
 */
export function useIntervalCleanup(intervalId: NodeJS.Timeout | null | undefined) {
  useEffect(() => {
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [intervalId]);
}

/**
 * Hook to clean up a timeout
 * @param timeoutId - Timeout ID from setTimeout
 */
export function useTimeoutCleanup(timeoutId: NodeJS.Timeout | null | undefined) {
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);
}

/**
 * Hook to clean up an event listener
 * @param element - Element to attach listener to (default: window)
 * @param event - Event name
 * @param handler - Event handler
 * @param options - Event listener options
 */
export function useEventListenerCleanup(
  element: EventTarget | null = typeof window !== 'undefined' ? window : null,
  event: string,
  handler: EventListener,
  options?: boolean | AddEventListenerOptions
) {
  useEffect(() => {
    if (!element) return;

    element.addEventListener(event, handler, options);
    return () => {
      element.removeEventListener(event, handler, options);
    };
  }, [element, event, handler, options]);
}


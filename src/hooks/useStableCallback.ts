import { useRef, useEffect, useCallback } from 'react';

/**
 * Hook to maintain stable callback references across re-renders
 * Prevents unnecessary re-subscriptions in effects
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef<T>(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(((...args: any[]) => {
    return callbackRef.current(...args);
  }) as T, []);
}

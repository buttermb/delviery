/**
 * Enhanced debounce hook for search inputs
 *
 * Returns the debounced value plus an `isPending` flag that indicates
 * the input value has changed but the debounce timer hasn't fired yet.
 * This lets search UIs show a subtle loading indicator while the user
 * is still typing.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseDebouncedValueReturn<T> {
  /** The debounced value (updates after the delay) */
  debouncedValue: T;
  /** True while the raw value differs from the debounced value */
  isPending: boolean;
  /** Immediately apply the current value, skipping the remaining delay */
  flush: () => void;
  /** Cancel any pending debounce and keep the current debounced value */
  cancel: () => void;
}

export function useDebouncedValue<T>(
  value: T,
  delay: number = 300,
): UseDebouncedValueReturn<T> {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef<T>(value);

  // Keep latest value in ref so flush can access it
  latestValueRef.current = value;

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    cancel();
    setDebouncedValue(latestValueRef.current);
  }, [cancel]);

  useEffect(() => {
    // If the value hasn't changed, no timer needed
    if (Object.is(value, debouncedValue)) {
      return;
    }

    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
      timerRef.current = null;
    }, delay);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [value, delay, debouncedValue]);

  // Clean up on unmount
  useEffect(() => {
    return cancel;
  }, [cancel]);

  const isPending = !Object.is(value, debouncedValue);

  return { debouncedValue, isPending, flush, cancel };
}

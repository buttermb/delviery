import { useState, useCallback, useEffect } from 'react';

import type { StorageKey } from '@/constants/storageKeys';
import { logger } from '@/lib/logger';
import { safeStorage } from '@/utils/safeStorage';

/**
 * Type-safe localStorage hook with STORAGE_KEYS integration
 *
 * Features:
 * - Type-safe get/set with JSON parse/stringify
 * - Try-catch wrapped for error handling
 * - Supports default values
 * - SSR-safe with typeof window check (via safeStorage)
 * - Cross-tab synchronization
 * - Memory fallback when localStorage is unavailable
 *
 * @param key - Storage key from STORAGE_KEYS constant
 * @param initialValue - Default value when key doesn't exist
 * @returns [value, setValue, clearValue] tuple
 *
 * @example
 * ```tsx
 * import { STORAGE_KEYS } from '@/constants/storageKeys';
 *
 * const [theme, setTheme, clearTheme] = useLocalStorage(STORAGE_KEYS.THEME, 'light');
 * const [columns, setColumns] = useLocalStorage(STORAGE_KEYS.DASHBOARD_WIDGETS, defaultColumns);
 * ```
 */
export function useLocalStorage<T>(
  key: StorageKey | string,
  initialValue: T
): readonly [T, (value: T | ((val: T) => T)) => void, () => void] {
  // State to store our value
  // Initialize from storage synchronously to avoid hydration mismatch
  const [storedValue, setStoredValue] = useState<T>(() => {
    // SSR-safe check is handled by safeStorage internally
    const item = safeStorage.getItem(key);
    if (item) {
      try {
        return JSON.parse(item) as T;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        logger.error(`Error parsing ${key} from localStorage`, errorObj, {
          key,
          component: 'useLocalStorage'
        });
        return initialValue;
      }
    }
    return initialValue;
  });

  // Memoized setter that persists to localStorage
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue((prevValue) => {
        const valueToStore = value instanceof Function ? value(prevValue) : value;

        if (valueToStore === null || valueToStore === undefined) {
          safeStorage.removeItem(key);
        } else {
          safeStorage.setItem(key, JSON.stringify(valueToStore));
        }

        return valueToStore;
      });
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error(`Error saving ${key} to localStorage`, errorObj, {
        key,
        component: 'useLocalStorage'
      });
    }
  }, [key]);

  // Clear value and reset to initial
  const clearValue = useCallback(() => {
    try {
      safeStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error(`Error clearing ${key} from localStorage`, errorObj, {
        key,
        component: 'useLocalStorage'
      });
    }
  }, [key, initialValue]);

  // Sync across browser tabs
  useEffect(() => {
    // SSR-safe check
    if (typeof window === 'undefined') return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== key) return;

      if (event.newValue === null) {
        // Key was removed in another tab
        setStoredValue(initialValue);
      } else {
        try {
          setStoredValue(JSON.parse(event.newValue) as T);
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));
          logger.warn(`Error syncing ${key} from storage event`, errorObj, {
            key,
            component: 'useLocalStorage'
          });
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, initialValue]);

  return [storedValue, setValue, clearValue] as const;
}

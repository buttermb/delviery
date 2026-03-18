import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { safeStorage } from '@/utils/safeStorage';

/**
 * Custom hook for managing state that persists to localStorage via safeStorage
 * Perfect for remembering user preferences like filters, sort order, etc.
 */
export function useLocalStorageState<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Get initial value from safeStorage or use provided initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    const item = safeStorage.getItem(key);
    if (item) {
      try {
        return JSON.parse(item);
      } catch (error) {
        logger.warn(`Error parsing safeStorage key "${key}":`, error);
        return initialValue;
      }
    }
    return initialValue;
  });

  // Update safeStorage when state changes
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        safeStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        logger.warn(`Error setting safeStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  // Clear the stored value
  const clearValue = useCallback(() => {
    safeStorage.removeItem(key);
    setStoredValue(initialValue);
  }, [key, initialValue]);

  // Sync across tabs (using storage event, which safeStorage doesn't abstract away but still works)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          logger.warn(`Error syncing localStorage key "${key}":`, error);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, [key]);

  return [storedValue, setValue, clearValue];
}

import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { safeStorage } from '@/utils/safeStorage';

export function useLocalStorage<T>(key: string, initialValue: T) {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(() => {
    const item = safeStorage.getItem(key);
    if (item) {
      try {
        return JSON.parse(item);
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        logger.error(`Error parsing ${key} from safeStorage`, errorObj, { key, component: 'useLocalStorage' });
        return initialValue;
      }
    }
    return initialValue;
  });

  // Return a wrapped version of useState's setter function that persists to safeStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (valueToStore === null) {
        safeStorage.removeItem(key);
      } else {
        safeStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error(`Error saving ${key} to safeStorage`, errorObj, { key, component: 'useLocalStorage' });
    }
  };

  return [storedValue, setValue] as const;
}

import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

export function useLocalStorage<T>(key: string, initialValue: T) {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error(`Error loading ${key} from localStorage`, errorObj, { key, component: 'useLocalStorage' });
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that persists to localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== 'undefined') {
        if (valueToStore === null) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error(`Error saving ${key} to localStorage`, errorObj, { key, component: 'useLocalStorage' });
    }
  };

  return [storedValue, setValue] as const;
}